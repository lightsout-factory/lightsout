import type { PullRequestSummary } from '#src/common/types/PullRequestSummary.ts';
import type { ShipStepFailure } from '#src/ship/common/types/ShipStepFailure.ts';
import { parseForgeJson } from '#src/ship/forge/common/parseForgeJson.ts';
import { runGh } from '#src/ship/forge/common/runGh.ts';
import { toPullRequestSummary } from '#src/ship/forge/common/toPullRequestSummary.ts';

interface Params {
	branch: string;
	/** The rendered pull request body — what replaces the commit-derived one. */
	body: string;
	cwd: string;
}

const readCreatedNumber = ({ stdout }: { stdout: string }) => {
	const segment = stdout.trim().split('\n').at(-1)?.split('/').at(-1) ?? '';
	const parsed = Number.parseInt(segment, 10);

	return Number.isNaN(parsed) ? undefined : parsed;
};

/**
 * `--fill-first` takes the title and body from the branch's first commit; plain
 * `--fill` would title a multi-commit branch with its slug. `gh pr create`
 * refuses `--body` alongside `--fill-first`, so the body is set by a second
 * call, and a third reads back what the forge actually recorded.
 */
export const createPullRequest = async ({ branch, body, cwd }: Params): Promise<PullRequestSummary | ShipStepFailure> => {
	const created = await runGh({ args: ['pr', 'create', '--fill-first', '--head', branch], cwd });
	const prNumber = created.exitCode === 0 ? readCreatedNumber({ stdout: created.stdout }) : undefined;

	if (prNumber === undefined) {
		return { stderr: created.stderr };
	}

	const edited = await runGh({ args: ['pr', 'edit', String(prNumber), '--body', body], cwd });

	if (edited.exitCode !== 0) {
		return { stderr: edited.stderr };
	}

	const viewed = await runGh({ args: ['pr', 'view', String(prNumber), '--json', 'number,url,title,headRefName'], cwd });
	const summary = viewed.exitCode === 0 ? toPullRequestSummary({ row: parseForgeJson({ stdout: viewed.stdout }) }) : undefined;

	return summary ?? { stderr: viewed.stderr };
};
