import { PlanRunStatus } from '#src/common/constants/PlanRunStatus.ts';
import { getBlockingFindings } from '#src/common/getBlockingFindings.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';
import { getPlanDetectionInputs } from '#src/plan/common/getPlanDetectionInputs.ts';
import { lintPlanStructure } from '#src/plan/lint/lintPlanStructure/lintPlanStructure.ts';

interface Params {
	cwd: string;
	/** Kebab plan name — the folder the plan's own files live in. */
	name: string;
	onProgress?: (message: string) => void;
}

type RunPlanLintResult =
	| { status: typeof PlanRunStatus.Complete; findings: StructuralFinding[]; planPaths: string[] }
	| { status: typeof PlanRunStatus.Failed; error: string };

/**
 * The same findings grade reports, with no agent and no workspace writes, so
 * the plan writer can converge in-session instead of paying a repair spawn per
 * finding.
 */
export const runPlanLint = async ({ cwd, name, onProgress }: Params): Promise<RunPlanLintResult> => {
	const progress = onProgress ?? (() => undefined);
	const inputs = await getPlanDetectionInputs({ cwd, name });

	if (inputs.error) {
		return { status: PlanRunStatus.Failed, error: inputs.error };
	}

	const findings = await lintPlanStructure({ cwd, planPaths: inputs.planPaths, decisions: inputs.decisions, config: inputs.config });

	const blocking = getBlockingFindings({ findings });

	progress(
		`plan lint ${name}: ${blocking.length} blocking, ${findings.length - blocking.length} advisory finding(s) across ${inputs.planPaths.length} file(s)`,
	);

	return { status: PlanRunStatus.Complete, findings, planPaths: inputs.planPaths };
};
