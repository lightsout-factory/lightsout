import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import { getExportName } from '#src/plan/common/utils/getExportName.ts';
import { buildExportCensus } from '#src/plan/evidence/buildExportCensus.ts';
import { detectExportCollisions } from '#src/plan/evidence/detectExportCollisions.ts';
import type { PriorArtCandidate } from '#src/plan/internal/common/types/PriorArtCandidate.ts';
import { parsePlan } from '#src/plan/parsePlan.ts';

interface Params {
	cwd: string;
	/** Absolute paths to the plan file(s) whose Files-to-Create symbols are checked. */
	planPaths: string[];
	config?: LightsoutConfig;
}

/**
 * The census is the repo the plan leaves behind: minus the paths the plan
 * creates, and minus the paths it empties (a deleted file, or the source side
 * of a move). Without that subtraction a plan that moves a symbol collides with
 * itself, and no resolution can clear it because the file is still on disk. A
 * move's destination is not added back: it is planned like any other new file.
 *
 * The plan is read through `parsePlan`, the parser the structural lint uses, so
 * the two never disagree about which section says what.
 */
export const detectPriorArtCandidates = async ({ cwd, planPaths, config }: Params): Promise<PriorArtCandidate[]> => {
	const planned: Array<{ plannedSymbol: string; plannedPath: string; phase: string }> = [];
	const plannedPaths = new Set<string>();
	const emptiedPaths = new Set<string>();

	for (const planPath of planPaths) {
		const planText = await readFile(planPath, 'utf8').catch(() => undefined);

		if (planText === undefined) {
			continue;
		}

		const base = basename(planPath);
		const plan = parsePlan({ content: planText, base });

		// Union across every plan file: a phase deleting a file empties it for the
		// whole plan, whichever phase planned the symbol that collided with it.
		for (const path of [...plan.deletePaths, ...plan.movePaths.map((move) => move.from)]) {
			emptiedPaths.add(path);
		}

		for (const createPath of plan.createPaths) {
			plannedPaths.add(createPath);

			const plannedSymbol = getExportName({ path: createPath });

			if (plannedSymbol === 'index') {
				continue;
			}

			planned.push({ plannedSymbol, plannedPath: createPath, phase: base });
		}
	}

	if (planned.length === 0) {
		return [];
	}

	const census = await buildExportCensus({ cwd, config, exclude: [...plannedPaths, ...emptiedPaths] });
	// One lookup per distinct symbol name, keyed by that name: two phases can plan
	// the same basename, and both have to be reported.
	const collisions = new Map(
		detectExportCollisions({ census, symbols: planned.map(({ plannedSymbol }) => plannedSymbol) }).map((collision) => [
			collision.symbol,
			collision.collidesWith,
		]),
	);
	const candidates: PriorArtCandidate[] = [];

	for (const { plannedSymbol, plannedPath, phase } of planned) {
		const collidesWith = collisions.get(plannedSymbol);

		if (collidesWith !== undefined) {
			candidates.push({ plannedSymbol, plannedPath, phase, collidesWith });
		}
	}

	return candidates;
};
