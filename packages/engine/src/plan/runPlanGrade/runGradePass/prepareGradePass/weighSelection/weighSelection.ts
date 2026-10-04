import { basename } from 'node:path';
import { defaultPackagesDir } from '#src/common/constants/defaultPackagesDir.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { PhaseWeight } from '#src/contracts/plan/grade/PhaseWeight.ts';
import { PlanWeight } from '#src/contracts/plan/grade/PlanWeight.ts';
import type { DeliverableFile } from '#src/plan/common/types/DeliverableFile.ts';
import { parsePlan } from '#src/plan/parsePlan/parsePlan.ts';
import { computePlanWeight } from '#src/plan/runPlanGrade/runGradePass/prepareGradePass/weighSelection/computePlanWeight.ts';
import { defaultWeightThresholds } from '#src/plan/runPlanGrade/runGradePass/prepareGradePass/weighSelection/defaultWeightThresholds.ts';

interface Params {
	selected: DeliverableFile[];
	config?: LightsoutConfig;
}

/** Computed at grade time rather than stamped at draft time, because the facts a draft is written from carry no create paths. */
export const weighSelection = ({ selected, config }: Params): { weights: PhaseWeight[]; heavy: DeliverableFile[]; light: string[] } => {
	if (config?.plan?.contract !== true) {
		return { weights: [], heavy: selected, light: [] };
	}

	const declared = config.plan['weight-thresholds'];
	const thresholds = {
		createdFiles: declared?.['created-files'] ?? defaultWeightThresholds.createdFiles,
		packages: declared?.packages ?? defaultWeightThresholds.packages,
	};
	const packagesDir = config['packages-dir'] ?? defaultPackagesDir;
	const weights = selected.map((file) => {
		const base = basename(file.path);

		return computePlanWeight({ plan: parsePlan({ content: file.text, base }), phase: base, packagesDir, thresholds });
	});
	const heavyPhases = new Set(weights.filter(({ weight }) => weight === PlanWeight.Heavy).map(({ phase }) => phase));

	return {
		weights,
		heavy: selected.filter((file) => heavyPhases.has(basename(file.path))),
		light: weights.filter(({ weight }) => weight === PlanWeight.Light).map(({ phase }) => phase),
	};
};
