import type { RenameRule } from '#src/contracts/plan/renames/RenameRule.ts';
import { pairCheckpointChanges } from '#src/pipeline/internal/common/checkpointChanges/pairCheckpointChanges.ts';
import { readCheckpointChanges } from '#src/pipeline/internal/common/checkpointChanges/readCheckpointChanges.ts';
import { readComparisonSides } from '#src/pipeline/internal/common/checkpointChanges/readComparisonSides.ts';
import { countTokens } from '#src/pipeline/internal/common/tokens/countTokens.ts';
import { describeTokenSurplus } from '#src/pipeline/internal/common/tokens/describeTokenSurplus.ts';
import type { CheckpointComparison } from '#src/pipeline/internal/common/types/CheckpointComparison.ts';
import type { PipelineRun } from '#src/pipeline/internal/PipelineRun.ts';
import { applyRenames } from '#src/pipeline/renameCheck/internal/common/utils/applyRenames.ts';

interface Params {
	run: PipelineRun;
	/** The verification checkpoint in flight — it labels the progress lines. */
	checkpoint: string;
	/** The plan's declared renames, in declared order. Never empty: the caller only asks for this check on a rename-only plan. */
	renames: RenameRule[];
}

const compareContent = async ({ run, comparison, renames }: { run: PipelineRun; comparison: CheckpointComparison; renames: RenameRule[] }) => {
	const { start, current, label } = await readComparisonSides({ run, comparison });
	const before = countTokens({ text: applyRenames({ text: start, renames }) });
	const after = countTokens({ text: applyRenames({ text: current, renames }) });
	const addedTokens = describeTokenSurplus({ more: after, less: before });
	const removedTokens = describeTokenSurplus({ more: before, less: after });

	return addedTokens === '' && removedTokens === '' ? undefined : `- ${label}: added ${addedTokens || 'nothing'}; removed ${removedTokens || 'nothing'}`;
};

/**
 * `HEAD` is the phase's starting state because a phase run commits only when it
 * passes, which also holds on a resume. Tokens are compared as a multiset because
 * the formatter re-wraps lines and re-sorts imports when their paths change.
 *
 * It fails closed: when git cannot report the working changes, nothing is proven.
 */
export const checkRenameOnlyChanges = async ({ run, checkpoint, renames }: Params): Promise<{ error?: string }> => {
	const changes = await readCheckpointChanges({ run });

	if (changes === undefined) {
		return { error: `${checkpoint}: the rename check could not read the working changes from git, so nothing is proven; no gate ran.` };
	}

	const { removed, added, modified } = changes;

	run.progress(
		`${checkpoint}: rename check — comparing ${removed.length + added.length + modified.length} changed file(s) against the phase's starting commit`,
	);

	const { comparisons, refusals } = pairCheckpointChanges({
		removed,
		added,
		modified,
		destinationOf: ({ path }) => applyRenames({ text: path, renames }),
		wording: { uncovered: 'no declared rename applies to its path', destination: 'renamed path', unclaimed: 'no removed file renames to it' },
	});

	for (const comparison of comparisons) {
		const refusal = await compareContent({ run, comparison, renames });

		if (refusal !== undefined) {
			refusals.push(refusal);
		}
	}

	if (refusals.length === 0) {
		run.progress(`${checkpoint}: rename check — every changed file holds only the declared renames`);
	}

	return refusals.length === 0 ? {} : { error: [`${checkpoint}: the rename check refused this checkpoint's changes; no gate ran.`, ...refusals].join('\n') };
};
