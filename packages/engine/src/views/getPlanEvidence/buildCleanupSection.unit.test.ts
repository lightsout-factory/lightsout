import { describe, expect, test } from '@jest/globals';
import type { CleanupSummary } from '#src/common/types/CleanupSummary.ts';
import type { RunSummary } from '#src/common/types/RunSummary.ts';
import type { DedupReport } from '#src/contracts/dedup/DedupReport.ts';
import { DedupResolution } from '#src/contracts/dedup/DedupResolution.ts';
import { CleanupEndReason } from '#src/contracts/run/CleanupEndReason.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import type { WorkReport } from '#src/contracts/work/WorkReport.ts';
import { WorkReportStatus } from '#src/contracts/work/WorkReportStatus.ts';
import { buildCleanupSection } from '#src/views/getPlanEvidence/buildCleanupSection.ts';
import type { BuildRun } from '#src/views/getPlanEvidence/common/types/BuildRun.ts';
import { runProgressManifestOf } from '#tests/helpers/runProgressManifestOf.ts';

type PriorArt = NonNullable<WorkReport['priorArt']>;

/** A finished cleanup that was handed nothing and left nothing, with whatever a case varies laid over it. */
const cleanupOf = (overrides: Partial<CleanupSummary> = {}): CleanupSummary => ({
	rounds: 1,
	endReason: CleanupEndReason.Clean,
	remainingFindings: 0,
	carriedFindings: 0,
	reviewFindings: 0,
	failures: 0,
	targetedFindings: 0,
	fixedFindings: 0,
	fixedSites: [],
	remainingSites: [],
	...overrides,
});

/** A run summary with no gate activity, carrying only the cleanup a case hands it. */
const summaryOf = ({ cleanup }: { cleanup?: CleanupSummary }): RunSummary => ({
	wallMs: 0,
	activeMs: 0,
	gateMs: 0,
	usage: undefined,
	cacheReadShare: undefined,
	steps: [],
	gates: { commands: 0, reruns: 0, skipped: 0, failed: 0, fixed: 0, selfChecks: 0 },
	testResultExecutions: [],
	verificationRepairs: [],
	cleanup,
	rejectedReports: 0,
	frictionByArea: [],
});

/** An executor step whose report records the given prior-art searches. */
const executorStepOf = ({ priorArt }: { priorArt: PriorArt }): StepRecord => ({
	id: 'implement',
	status: RunStatus.Passed,
	attempts: 1,
	report: { status: WorkReportStatus.Complete, changedFiles: [], summary: 'built the widget reader', failures: [], priorArt } satisfies WorkReport,
});

/** One run of the build family, its folder invented: the section reads only the manifest and the summary. */
const buildRunOf = ({ runId, steps = [], cleanup }: { runId: string; steps?: StepRecord[]; cleanup?: CleanupSummary }): BuildRun => ({
	manifest: runProgressManifestOf({ runId, steps }),
	summary: summaryOf({ cleanup }),
	runDir: `/repo/.lightsout/runs/${runId}`,
});

/** One executor's two searches, a miss and a hit, beside a duplicate check that found nothing. */
const setupSearchesAndEmptyDedup = () => {
	const runs = [
		buildRunOf({
			runId: 'run-build',
			steps: [
				executorStepOf({
					priorArt: [
						{ symbol: 'readWidget', searches: ['readWidget', '*Widget*'], matches: [] },
						{ symbol: 'formatWidget', searches: ['format*'], matches: ['formatGadget'] },
					],
				}),
			],
		}),
	];
	const dedup: DedupReport = {
		planName: 'lo-16-demo/plan-a',
		findings: [],
		reviewed: [],
		complete: true,
		reviewedAt: '2026-01-01T00:00:00.000Z',
	};

	return { runs, dedup };
};

const fixedNesting = { rule: 'acme/max-nesting', files: ['src/a.ts', 'src/a-helper.ts'] };
const fixedLength = { rule: 'acme/file-length', files: ['src/b.ts'] };
const remainingNaming = { rule: 'acme/naming', files: ['src/c.ts'] };
const remainingImports = { rule: 'acme/import-order', files: ['src/d.ts'] };

/**
 * Two cleanup records. With `recorded` the first was handed three findings and
 * fixed two, and the second predates `targeted`; without it, both predate it.
 */
const setupCleanupFamily = ({ recorded }: { recorded: boolean }) => {
	const first = recorded
		? cleanupOf({
				targetedFindings: 3,
				fixedFindings: 2,
				fixedSites: [fixedNesting, fixedLength],
				remainingSites: [remainingNaming],
				carriedFindings: 1,
				reviewFindings: 2,
			})
		: cleanupOf({ targetedFindings: undefined, fixedFindings: undefined, remainingSites: [remainingNaming], carriedFindings: 1, reviewFindings: 2 });
	const second = cleanupOf({
		targetedFindings: undefined,
		fixedFindings: undefined,
		remainingSites: [remainingImports],
		carriedFindings: 2,
		reviewFindings: 1,
	});
	const runs = [buildRunOf({ runId: 'run-coordinator', cleanup: first }), buildRunOf({ runId: 'run-child', cleanup: second })];

	return { runs };
};

/** Either a family whose only record is one prior-art search, or one whose cleanup is still running. */
const setupUnfinishedCleanup = ({ cleanupRunning }: { cleanupRunning: boolean }) => {
	const runs = cleanupRunning
		? [buildRunOf({ runId: 'run-build', cleanup: cleanupOf({ endReason: undefined, targetedFindings: 1, fixedFindings: 0 }) })]
		: [buildRunOf({ runId: 'run-build', steps: [executorStepOf({ priorArt: [{ symbol: 'readWidget', searches: ['readWidget'], matches: [] }] })] })];

	return { runs };
};

/** A family whose only step reports no prior-art searches, with no cleanup record and no duplicate check. */
const setupNoCleanupRecords = () => {
	const runs = [buildRunOf({ runId: 'run-build', steps: [{ id: 'verify-implement', status: RunStatus.Passed, attempts: 1 }] })];

	return { runs };
};

/** A duplicate check that found one duplicate, beside a family with nothing else, while the build is still going. */
const setupDuplicatesWhileGoing = () => {
	const runs = [buildRunOf({ runId: 'run-build' })];
	const dedup: DedupReport = {
		planName: 'lo-16-demo/plan-a',
		findings: [
			{
				plannedSymbol: 'readWidget',
				recommendation: DedupResolution.Extend,
				rationale: 'readGadget already reads the same file',
				migrateCallers: [],
				plannedPath: 'src/readWidget.ts',
				phase: 'plan.md',
				collidesWith: [{ name: 'readGadget', path: 'src/readGadget.ts' }],
			},
		],
		reviewed: [],
		complete: true,
		reviewedAt: '2026-01-01T00:00:00.000Z',
	};

	return { runs, dedup, going: true };
};

describe('buildCleanupSection', () => {
	test('buildCleanupSection: keeps searches with their misses and leaves out an empty duplicate check', () => {
		const { runs, dedup } = setupSearchesAndEmptyDedup();

		const section = buildCleanupSection({ runs, dedup, going: false });

		expect({ searches: section?.searches, duplicates: section?.duplicates }).toEqual({
			searches: [
				{ symbol: 'readWidget', searches: ['readWidget', '*Widget*'], matches: [], provenance: 'reported' },
				{ symbol: 'formatWidget', searches: ['format*'], matches: ['formatGadget'], provenance: 'reported' },
			],
			duplicates: undefined,
		});
	});

	test.each([
		{
			recorded: true,
			found: { value: 3, provenance: 'measured' },
			fixed: [
				{ ...fixedNesting, provenance: 'measured' },
				{ ...fixedLength, provenance: 'measured' },
			],
		},
		{ recorded: false, found: undefined, fixed: [] },
	])('buildCleanupSection: sums found and lists fixed only where recorded', ({ recorded, found, fixed }) => {
		const { runs } = setupCleanupFamily({ recorded });

		const section = buildCleanupSection({ runs, dedup: undefined, going: false });

		expect(section?.standards).toEqual({
			state: 'finished',
			found,
			fixed,
			remaining: [
				{ ...remainingNaming, provenance: 'measured' },
				{ ...remainingImports, provenance: 'measured' },
			],
			carried: { value: 3, provenance: 'measured' },
			reviewFindings: { value: 3, provenance: 'reported' },
		});
	});

	test.each([
		{ cleanupRunning: false, expected: { sectionState: 'finished', searches: ['readWidget'], standardsState: undefined } },
		{ cleanupRunning: true, expected: { sectionState: 'in-progress', searches: [], standardsState: 'in-progress' } },
	])('buildCleanupSection: a cleanup that never ran has no standards part, and one still running is in progress', ({ cleanupRunning, expected }) => {
		const { runs } = setupUnfinishedCleanup({ cleanupRunning });

		const section = buildCleanupSection({ runs, dedup: undefined, going: false });

		expect({
			sectionState: section?.state,
			searches: section?.searches.map((search) => search.symbol),
			standardsState: section?.standards?.state,
		}).toEqual(expected);
	});

	test('buildCleanupSection: absent when the family holds no cleanup record, no search and no duplicate', () => {
		const { runs } = setupNoCleanupRecords();

		const section = buildCleanupSection({ runs, dedup: undefined, going: false });

		expect(section).toBeUndefined();
	});

	test('buildCleanupSection: counts the duplicates found and marks the section in progress while the build is going', () => {
		const { runs, dedup, going } = setupDuplicatesWhileGoing();

		const section = buildCleanupSection({ runs, dedup, going });

		expect(section).toEqual({
			state: 'in-progress',
			standards: undefined,
			searches: [],
			duplicates: { value: 1, provenance: 'reported' },
		});
	});
});
