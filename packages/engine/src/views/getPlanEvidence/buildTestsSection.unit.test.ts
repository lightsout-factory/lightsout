import { mkdtempSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import type { RunSummary } from '#src/common/types/RunSummary.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { TestReviewDecision } from '#src/contracts/work/TestReviewDecision.ts';
import { buildTestsSection } from '#src/views/getPlanEvidence/buildTestsSection.ts';
import type { BuildRun } from '#src/views/getPlanEvidence/common/types/BuildRun.ts';
import { seedRunDir } from '#tests/helpers/seedRunDir.ts';

/** One gate execution that recorded a results directory, and how many distinct tests it answered. */
interface ExecutionSeed {
	step: string;
	group: string;
	kind: string;
	tests: number;
}

interface RunSeed {
	runId: string;
	/** How many acceptance tests the manifest records. */
	acceptanceTests?: number;
	/** One `test-reviews.jsonl` record per entry; absent writes no review log at all. */
	reviews?: { verdicts: number; rejections: number }[];
	/** In the order the run's summary lists them. */
	executions?: ExecutionSeed[];
}

const planName = 'lo-16-demo/evidence';

const manifestOf = ({ runId, acceptanceTests }: { runId: string; acceptanceTests: number }): RunManifest => ({
	runId,
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:00.000Z',
	plan: 'plans/demo/plan.md',
	planName,
	harness: 'claude-code',
	status: RunStatus.Passed,
	currentStep: null,
	steps: [],
	changedFiles: [],
	commits: [],
	packages: [],
	baselineDirtyFiles: [],
	acceptanceTests: Array.from({ length: acceptanceTests }, (_, index) => ({
		criterion: `criterion ${index + 1}`,
		testFile: 'packages/acme/src/widget.unit.test.ts',
		testName: `widget case ${index + 1}`,
		gate: 'test',
	})),
	approvedTests: [],
	coverageExcludedChangedFiles: [],
});

const summaryOf = ({ executions }: { executions: ExecutionSeed[] }): RunSummary => ({
	wallMs: 0,
	activeMs: 0,
	gateMs: 0,
	usage: undefined,
	cacheReadShare: undefined,
	steps: [],
	gates: { commands: 0, reruns: 0, skipped: 0, failed: 0, fixed: 0, selfChecks: 0 },
	verificationRepairs: [],
	cleanup: undefined,
	rejectedReports: 0,
	frictionByArea: [],
	testResultExecutions: executions.map(({ step, group, kind }) => ({ step, group, kind })),
});

/**
 * One execution's results as the reporter writes them. Tests alternate between
 * two files that reuse the same full names, so only the file plus full name
 * pair tells them apart; a second results file repeats the first test, which
 * a distinct count must not count twice.
 */
const writeResults = async ({ cwd, runDir, execution }: { cwd: string; runDir: string; execution: ExecutionSeed }) => {
	// Spelled here rather than asked of `testResultsDir`, so the fixture states the layout it expects.
	const dir = join(runDir, 'test-results', execution.step, execution.group, execution.kind);
	const assertions = Array.from({ length: execution.tests }, (_, index) => ({
		testFilePath: join(cwd, 'packages', 'acme', 'src', index % 2 === 0 ? 'alpha.unit.test.ts' : 'beta.unit.test.ts'),
		assertionResults: [{ title: `case ${Math.floor(index / 2) + 1}`, ancestorTitles: [], fullName: `case ${Math.floor(index / 2) + 1}`, status: 'passed' }],
	}));

	await mkdir(dir, { recursive: true });
	await writeFile(join(dir, '4101-1750000000000.json'), JSON.stringify({ testResults: assertions }), 'utf8');
	await writeFile(join(dir, '4102-1750000000001.json'), JSON.stringify({ testResults: assertions.slice(0, 1) }), 'utf8');
};

const writeReviews = async ({ runDir, reviews }: { runDir: string; reviews: { verdicts: number; rejections: number }[] }) => {
	const lines = reviews.map(({ verdicts, rejections }, index) =>
		JSON.stringify({
			checkpoint: `verify-${index + 1}`,
			at: '2026-01-01T00:00:00.000Z',
			verdicts: Array.from({ length: verdicts }, (_, verdict) => ({
				path: `packages/acme/src/file${verdict + 1}.unit.test.ts`,
				decision: TestReviewDecision.Approve,
				reason: 'The plan renames the subject this test imports.',
				acceptanceTests: [],
			})),
			rejections: Array.from({ length: rejections }, (_, rejection) => `packages/acme/src/rejected${rejection + 1}.unit.test.ts was weakened`),
		}),
	);

	await writeFile(join(runDir, 'test-reviews.jsonl'), `${lines.join('\n')}\n`, 'utf8');
};

/** A build family on disk: each run's manifest, review log and results directories, plus the `BuildRun` the view hands the builder. */
const setupFamily = async ({ runs, going = false }: { runs: RunSeed[]; going?: boolean }) => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-tests-section-'));
	const family: BuildRun[] = [];

	for (const { runId, acceptanceTests = 0, reviews, executions = [] } of runs) {
		const manifest = manifestOf({ runId, acceptanceTests });
		const runDir = await seedRunDir({ cwd, manifest });

		if (reviews !== undefined) {
			await writeReviews({ runDir, reviews });
		}

		for (const execution of executions) {
			await writeResults({ cwd, runDir, execution });
		}

		family.push({ manifest, summary: summaryOf({ executions }), runDir });
	}

	return { cwd, runs: family, going };
};

const sharedExecutions: ExecutionSeed[] = [
	{ step: 'verify-implement', group: 'engine', kind: 'test', tests: 10 },
	{ step: 'verify-refactor', group: 'engine', kind: 'test', tests: 14 },
];

describe('buildTestsSection', () => {
	test('buildTestsSection: acceptance tests, reviews and the before and after test count', async () => {
		const { cwd, runs, going } = await setupFamily({
			runs: [
				{
					runId: 'run-build-0001',
					acceptanceTests: 4,
					reviews: [
						{ verdicts: 2, rejections: 1 },
						{ verdicts: 1, rejections: 0 },
					],
					executions: sharedExecutions,
				},
			],
		});

		const section = await buildTestsSection({ cwd, runs, going });

		expect(section).toStrictEqual({
			state: 'finished',
			acceptanceTests: { value: 4, provenance: 'measured' },
			reviewedFiles: { value: 3, provenance: 'reported' },
			rejections: { value: 1, provenance: 'reported' },
			testCount: { before: { value: 10, provenance: 'measured' }, after: { value: 14, provenance: 'measured' } },
		});
	});

	// One row per missing record; toEqual reads an undefined figure as absent, so
	// each row pins that the figure is not drawn rather than drawn as zero.
	test.each([
		{
			seed: { runId: 'run-build-0002', reviews: [{ verdicts: 3, rejections: 1 }], executions: sharedExecutions },
			expected: {
				state: 'finished',
				reviewedFiles: { value: 3, provenance: 'reported' },
				rejections: { value: 1, provenance: 'reported' },
				testCount: { before: { value: 10, provenance: 'measured' }, after: { value: 14, provenance: 'measured' } },
			},
		},
		{
			seed: { runId: 'run-build-0003', acceptanceTests: 4, executions: sharedExecutions },
			expected: {
				state: 'finished',
				acceptanceTests: { value: 4, provenance: 'measured' },
				testCount: { before: { value: 10, provenance: 'measured' }, after: { value: 14, provenance: 'measured' } },
			},
		},
		{
			seed: {
				runId: 'run-build-0004',
				acceptanceTests: 4,
				reviews: [{ verdicts: 3, rejections: 1 }],
				executions: [
					{ step: 'verify-implement', group: 'engine', kind: 'test', tests: 10 },
					{ step: 'verify-refactor', group: 'web-app', kind: 'test', tests: 14 },
				],
			},
			expected: {
				state: 'finished',
				acceptanceTests: { value: 4, provenance: 'measured' },
				reviewedFiles: { value: 3, provenance: 'reported' },
				rejections: { value: 1, provenance: 'reported' },
			},
		},
	])('buildTestsSection: no figure without its record, and no test count without a shared gate execution', async ({ seed, expected }) => {
		const { cwd, runs, going } = await setupFamily({ runs: [seed] });

		const section = await buildTestsSection({ cwd, runs, going });

		expect(section).toEqual(expected);
	});

	test('buildTestsSection: compares only the gate executions both checkpoints share', async () => {
		const { cwd, runs, going } = await setupFamily({
			runs: [
				{
					runId: 'run-build-0005',
					acceptanceTests: 1,
					executions: [
						{ step: 'verify-implement', group: 'a', kind: 'test', tests: 5 },
						{ step: 'verify-implement', group: 'b', kind: 'test', tests: 7 },
						{ step: 'verify-refactor', group: 'a', kind: 'test', tests: 6 },
					],
				},
			],
		});

		const section = await buildTestsSection({ cwd, runs, going });

		expect(section?.testCount).toStrictEqual({ before: { value: 5, provenance: 'measured' }, after: { value: 6, provenance: 'measured' } });
	});

	test('buildTestsSection: the first checkpoint is the earliest recording run and the last the latest one', async () => {
		const { cwd, runs, going } = await setupFamily({
			runs: [
				{ runId: 'run-coordinator', acceptanceTests: 1 },
				{ runId: 'run-phase-one', executions: [{ step: 'verify-implement', group: 'engine', kind: 'test', tests: 8 }] },
				{ runId: 'run-phase-two', executions: [{ step: 'verify-implement', group: 'engine', kind: 'test', tests: 12 }] },
			],
		});

		const section = await buildTestsSection({ cwd, runs, going });

		expect(section?.testCount).toStrictEqual({ before: { value: 8, provenance: 'measured' }, after: { value: 12, provenance: 'measured' } });
	});

	test.each([
		{
			holding: 'one recorded step, so the first and last checkpoints are the same',
			executions: [{ step: 'verify-implement', group: 'engine', kind: 'test', tests: 10 }],
		},
		{
			holding: 'a shared gate execution that answered no test at the first checkpoint',
			executions: [
				{ step: 'verify-implement', group: 'engine', kind: 'test', tests: 0 },
				{ step: 'verify-refactor', group: 'engine', kind: 'test', tests: 14 },
			],
		},
	])('buildTestsSection: no test count from $holding', async ({ executions }) => {
		const { cwd, runs, going } = await setupFamily({ runs: [{ runId: 'run-build-0006', acceptanceTests: 2, executions }] });

		const section = await buildTestsSection({ cwd, runs, going });

		expect(section).toStrictEqual({ state: 'finished', acceptanceTests: { value: 2, provenance: 'measured' } });
	});

	test('buildTestsSection: a family with no acceptance test, review or test count has no section', async () => {
		const { cwd, runs, going } = await setupFamily({ runs: [{ runId: 'run-build-0007' }] });

		const section = await buildTestsSection({ cwd, runs, going });

		expect(section).toBeUndefined();
	});

	test('buildTestsSection: a build still going marks the section in progress', async () => {
		const { cwd, runs, going } = await setupFamily({ runs: [{ runId: 'run-build-0008', acceptanceTests: 1 }], going: true });

		const section = await buildTestsSection({ cwd, runs, going });

		expect(section?.state).toBe('in-progress');
	});
});
