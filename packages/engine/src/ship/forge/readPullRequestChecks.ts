import { z } from 'zod';
import type { ChecksSummary } from '#src/ship/common/types/ChecksSummary.ts';
import { parseForgeJson } from '#src/ship/forge/common/parseForgeJson.ts';
import { runGh } from '#src/ship/forge/common/runGh.ts';

interface Params {
	prNumber: number;
	cwd: string;
	/** The exact candidate commit the caller pushed — the only commit whose rows may count. */
	expectedHead: string;
}

/** The rows `gh pr checks --json name,state,bucket` prints; anything unrecognisable is dropped rather than guessed at. */
const CheckRows = z.array(z.object({ name: z.string(), bucket: z.string() }).catchall(z.unknown()));

const HeadView = z.object({ headRefOid: z.string() });

const redBuckets = new Set(['fail', 'cancel']);

const greenBuckets = new Set(['pass', 'skipping']);

/** A bucket this reader does not know is missing evidence, never a green. */
const knownBuckets = new Set([...redBuckets, ...greenBuckets, 'pending']);

const standsOnExpectedHead = async ({ prNumber, cwd, expectedHead }: Params) => {
	const viewed = await runGh({ args: ['pr', 'view', String(prNumber), '--json', 'headRefOid'], cwd });
	const head = HeadView.safeParse(parseForgeJson({ stdout: viewed.stdout }));

	return head.success && head.data.headRefOid === expectedHead;
};

/**
 * `gh pr checks` exits 8 while checks are pending and 1 when some failed, so
 * the exit code is ignored and only the JSON is read. `skipping` counts as
 * green: a check the forge chose not to run cannot be waited on.
 *
 * The head is read before and after the rows, so a commit someone else pushed
 * meanwhile is never merged under this evidence. Whether an empty list means
 * "no CI" is `waitForChecks`'s call.
 */
export const readPullRequestChecks = async ({ prNumber, cwd, expectedHead }: Params): Promise<ChecksSummary | undefined> => {
	if (!(await standsOnExpectedHead({ prNumber, cwd, expectedHead }))) {
		return undefined;
	}

	const checked = await runGh({ args: ['pr', 'checks', String(prNumber), '--json', 'name,state,bucket'], cwd });
	const rows = CheckRows.safeParse(parseForgeJson({ stdout: checked.stdout }));

	if (!rows.success || rows.data.some((row) => !knownBuckets.has(row.bucket))) {
		return undefined;
	}

	if (!(await standsOnExpectedHead({ prNumber, cwd, expectedHead }))) {
		return undefined;
	}

	const failing = rows.data.filter((row) => redBuckets.has(row.bucket)).map((row) => row.name);
	const pending = rows.data.filter((row) => row.bucket === 'pending').map((row) => row.name);
	const passing = rows.data.filter((row) => greenBuckets.has(row.bucket)).map((row) => row.name);

	return { finished: pending.length === 0, green: failing.length === 0, failing, pending, passing, readable: true };
};
