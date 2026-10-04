import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { DecisionsRecord } from '#src/contracts/plan/decisions/DecisionsRecord.ts';
import { lintPlanStructure } from '#src/plan/lint/lintPlanStructure/lintPlanStructure.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';

/** Plant a file the plan claims already exists, so a `## Files to Modify` heading is not a broken reference. */
const plant = ({ cwd, paths }: { cwd: string; paths: string[] }) => {
	for (const path of paths) {
		mkdirSync(join(cwd, dirname(path)), { recursive: true });
		writeFileSync(join(cwd, path), 'export const planted = 1;\n');
	}
};

/** A consumer repo holding a phased deliverable — an overview and its phase files — and the record the draft was started from. */
export const setupPhasedDeliverable = ({
	overview,
	phases,
	decisions,
	existing = [],
}: {
	overview: string;
	phases: Record<string, string>;
	decisions: DecisionsRecord;
	existing?: string[];
}) => {
	const cwd = setupConsumerRepo();
	const dir = join(cwd, '.lightsout', 'work-orders', 'demo', 'plans');

	mkdirSync(dir, { recursive: true });
	plant({ cwd, paths: existing });

	const overviewPath = join(dir, 'overview.md');

	writeFileSync(overviewPath, overview);

	const phasePaths = Object.entries(phases).map(([base, body]) => {
		const path = join(dir, base);

		writeFileSync(path, body);

		return path;
	});
	const planPaths = [overviewPath, ...phasePaths];

	return {
		cwd,
		name: 'demo',
		decisions,
		planPaths,
		overviewPath,
		lint: () => lintPlanStructure({ cwd, planPaths, decisions }),
		read: ({ base }: { base: string }) => readFileSync(join(dir, base), 'utf8'),
	};
};
