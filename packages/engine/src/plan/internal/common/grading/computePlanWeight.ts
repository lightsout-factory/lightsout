import { packageOf } from '#src/common/workspace/packageOf.ts';
import type { PhaseWeight } from '#src/contracts/plan/grade/PhaseWeight.ts';
import { PlanWeight } from '#src/contracts/plan/grade/PlanWeight.ts';
import type { ParsedPlan } from '#src/plan/internal/common/types/ParsedPlan.ts';
import { getPlanTouchedPaths } from '#src/plan/internal/common/utils/getPlanTouchedPaths.ts';

interface Params {
	plan: ParsedPlan;
	phase: string;
	packagesDir: string;
	/** Already merged over `defaultWeightThresholds`. */
	thresholds: { createdFiles: number; packages: number };
}

/** A path under no package is the repository root, which counts as one package like any other. */
const countPackages = ({ touched, packagesDir }: { touched: string[]; packagesDir: string }) =>
	new Set(touched.map((file) => packageOf({ file, packagesDir }) ?? '<root>')).size;

/**
 * The numbers come from the plan rather than the facts, unlike
 * `estimatePlanScope`: by grade time the plan itself is the better record.
 *
 * A file with nothing to mirror is always heavy, whatever its counts: a plan
 * following no existing pattern is exactly where a reader earns its cost.
 */
export const computePlanWeight = ({ plan, phase, packagesDir, thresholds }: Params): PhaseWeight => {
	const { created, touched } = getPlanTouchedPaths({ plan });
	const packages = countPackages({ touched, packagesDir });
	const reasons: string[] = [];

	if (created.length > thresholds.createdFiles) {
		reasons.push(`creates ${created.length} source files, above ${thresholds.createdFiles}`);
	}

	if (packages > thresholds.packages) {
		reasons.push(`touches ${packages} packages, above ${thresholds.packages}`);
	}

	if (plan.mirrorPaths.length === 0) {
		reasons.push('names no pattern to mirror');
	}

	return { phase, weight: reasons.length === 0 ? PlanWeight.Light : PlanWeight.Heavy, reasons };
};
