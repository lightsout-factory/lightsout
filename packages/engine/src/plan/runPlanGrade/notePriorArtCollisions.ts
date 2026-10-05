import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DedupReport } from '#src/contracts/dedup/DedupReport.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { detectPriorArtCandidates } from '#src/plan/common/detection/detectPriorArtCandidates.ts';
import type { PriorArtCandidate } from '#src/plan/common/types/PriorArtCandidate.ts';

interface Params {
	cwd: string;
	name: string;
	/** Where a previous pass left `dedup.json`. */
	workspaceDir: string;
	planPaths: string[];
	config?: LightsoutConfig;
	onProgress: (message: string) => void;
}

/** The same name planned at two paths, or in two plan files, is two collisions. */
const collisionKey = ({ plannedSymbol, plannedPath, phase }: { plannedSymbol: string; plannedPath: string; phase: string }): string =>
	`${phase} ${plannedPath} ${plannedSymbol}`;

/**
 * Every failure reads as an empty set, which keeps the nudge rather than
 * silencing it. It never throws: this is one advisory line on a grade that has
 * already done its real work.
 */
const readSettledCollisions = async ({ workspaceDir }: { workspaceDir: string }): Promise<Set<string>> => {
	const text = await readFile(join(workspaceDir, 'dedup.json'), 'utf8').catch(() => undefined);

	if (text === undefined) {
		return new Set();
	}

	try {
		const parsed = DedupReport.safeParse(JSON.parse(text));

		return parsed.success ? new Set(parsed.data.reviewed.map(collisionKey)) : new Set();
	} catch {
		return new Set();
	}
};

/**
 * Advisory only — it nudges, never gates. A collision dedup already ruled on is
 * filtered out: it stays detectable on disk when the resolution kept both files,
 * and re-reporting it would repeat a finding with no work left in it.
 */
export const notePriorArtCollisions = async ({ cwd, name, workspaceDir, planPaths, config, onProgress }: Params): Promise<void> => {
	const candidates: PriorArtCandidate[] = await detectPriorArtCandidates({ cwd, planPaths, config });
	const settled = await readSettledCollisions({ workspaceDir });
	const unweighed = candidates.filter((candidate) => !settled.has(collisionKey(candidate)));

	if (unweighed.length > 0) {
		onProgress(
			`plan grade ${name}: ${unweighed.length} planned symbol(s) still name-collide with existing exports — run \`lightsout plan dedup --name ${name}\``,
		);
	}
};
