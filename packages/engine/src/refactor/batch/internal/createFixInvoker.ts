import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { buildBatchFixInvocation } from '#src/refactor/batch/internal/buildBatchFixInvocation.ts';
import { standaloneBanner } from '#src/refactor/batch/internal/common/constants/standaloneBanner.ts';
import type { BatchTools } from '#src/refactor/batch/internal/common/types/BatchTools.ts';
import type { settleBatchGates } from '#src/refactor/batch/internal/settleBatchGates.ts';

interface Params {
	tools: BatchTools;
	files: string[];
	workFindings: StandardsFinding[];
	advisories: StandardsFinding[];
	standards?: string;
	testStandards?: string;
}

/** Shared by every pass that can turn a gate red, so the fixing agent gets the same account of the work from each. */
export const createFixInvoker =
	({ tools, files, workFindings, advisories, standards, testStandards }: Params): Parameters<typeof settleBatchGates>[0]['invokeFix'] =>
	({ label, gateError, guidance }) =>
		tools.invoke({
			label,
			invocation: buildBatchFixInvocation({
				planContent: standaloneBanner,
				files,
				standards,
				testStandards,
				findings: workFindings,
				advisories,
				gateError,
				guidance,
			}),
		});
