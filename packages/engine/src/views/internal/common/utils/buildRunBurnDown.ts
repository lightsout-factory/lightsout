import { CoverageBatchReport } from '#src/contracts/coverage/CoverageBatchReport.ts';
import { BatchReport } from '#src/contracts/refactor/BatchReport.ts';
import type { RefactorBatch } from '#src/contracts/refactor/RefactorBatch.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import type { RunBurnDown } from '#src/contracts/views/runBurnDown/RunBurnDown.ts';
import type { RunBurnDownBatch } from '#src/contracts/views/runBurnDown/RunBurnDownBatch.ts';
import { RunBurnDownBatchOutcome } from '#src/contracts/views/runBurnDown/RunBurnDownBatchOutcome.ts';
import type { FrozenWorklist } from '#src/views/internal/common/types/FrozenWorklist.ts';

interface JoinedBatch {
	row: RunBurnDownBatch;
	remaining: number;
}

/** `test-file-size` is deliberately outside the set: it never forms a batch. */
const overCapRules = new Set(['file-size', 'function-size', 'folder-size']);

const sumOver = ({ entries, read }: { entries: JoinedBatch[]; read: (entry: JoinedBatch) => number }) =>
	entries.reduce((total, entry) => total + read(entry), 0);

/**
 * A batch the run never reached, or whose report will not parse, reads as
 * `not-run` and counts its blocking findings as still standing, so a run that
 * stopped early reads as barely started rather than nearly done.
 */
const toBurnDownBatch = ({ batch, step }: { batch: RefactorBatch; step?: StepRecord }) => {
	const report = step === undefined ? undefined : BatchReport.safeParse(step.report).data;
	const joined: JoinedBatch = {
		row: {
			id: batch.id,
			rule: batch.rule,
			folder: batch.folder,
			blocking: batch.blocking.length,
			outcome: report?.outcome ?? RunBurnDownBatchOutcome.NotRun,
			rationale: report?.rationale ?? [],
			advisoryOutcomes: report?.advisoryOutcomes ?? [],
		},
		remaining: report === undefined ? batch.blocking.length : report.remainingSiteKeys.length,
	};

	return joined;
};

const buildRefactorBurnDown = ({ manifest, batches }: { manifest: RunManifest; batches: RefactorBatch[] }) => {
	const steps: Map<string, StepRecord> = new Map(manifest.steps.map((step) => [step.id, step]));
	const joined = batches.map((batch) => toBurnDownBatch({ batch, step: steps.get(batch.id) }));
	const overCap = joined.filter((entry) => overCapRules.has(entry.row.rule));
	const burnDown: RunBurnDown = {
		before: sumOver({ entries: joined, read: (entry) => entry.row.blocking }),
		after: sumOver({ entries: joined, read: (entry) => entry.remaining }),
		// An already-fixed batch is recorded as resolved with no remaining keys,
		// byte-identical to an agent-resolved one, so the two are not told apart.
		batchesResolved: joined.filter((entry) => entry.row.outcome === RunBurnDownBatchOutcome.Resolved).length,
		batchesDeclined: joined.filter((entry) => entry.row.outcome === RunBurnDownBatchOutcome.Declined).length,
		batches: joined.map((entry) => entry.row),
		overCap:
			overCap.length === 0
				? undefined
				: {
						before: sumOver({ entries: overCap, read: (entry) => entry.row.blocking }),
						after: sumOver({ entries: overCap, read: (entry) => entry.remaining }),
					},
	};

	return burnDown;
};

/**
 * No before/after count: the threshold the run chased lives in the repo's
 * coverage command, not the manifest.
 */
const buildCoverageBurnDown = ({ manifest }: { manifest: RunManifest }) => {
	const merged = new Map<string, { path: string; beforePct: number; afterPct: number }>();
	let measured = false;

	for (const step of manifest.steps) {
		const report = CoverageBatchReport.safeParse(step.report).data;

		if (report !== undefined) {
			measured = true;

			for (const file of report.files) {
				merged.set(file.path, { path: file.path, beforePct: merged.get(file.path)?.beforePct ?? file.beforePct, afterPct: file.afterPct });
			}
		}
	}

	const burnDown: RunBurnDown | undefined = measured
		? { batches: [], files: [...merged.values()].sort((first, second) => first.afterPct - second.afterPct || first.path.localeCompare(second.path)) }
		: undefined;

	return burnDown;
};

interface Params {
	manifest: RunManifest;
	/** The run's frozen work-list, already read by the run detail's own helper. */
	worklist: FrozenWorklist | undefined;
}

export const buildRunBurnDown = ({ manifest, worklist }: Params): RunBurnDown | undefined => {
	let burnDown: RunBurnDown | undefined;

	if (manifest.pipeline === PipelineKind.Coverage) {
		burnDown = buildCoverageBurnDown({ manifest });
	}

	if (manifest.pipeline === PipelineKind.Refactor && worklist?.kind === PipelineKind.Refactor && worklist.worklist !== undefined) {
		burnDown = buildRefactorBurnDown({ manifest, batches: worklist.worklist.batches });
	}

	return burnDown;
};
