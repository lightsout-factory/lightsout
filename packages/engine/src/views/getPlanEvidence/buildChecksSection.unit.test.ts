import { describe, expect, test } from '@jest/globals';
import type { RunSummary } from '#src/common/types/RunSummary.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { buildChecksSection } from '#src/views/getPlanEvidence/buildChecksSection.ts';
import type { BuildRun } from '#src/views/getPlanEvidence/common/types/BuildRun.ts';
import { runProgressManifestOf } from '#tests/helpers/runProgressManifestOf.ts';

interface GateFigures {
	commands: number;
	failed: number;
	fixed: number;
	selfChecks: number;
}

interface RunParams {
	runId: string;
	gates: GateFigures;
	verificationRepairs: RunSummary['verificationRepairs'];
}

/** A finished family run whose summary holds only the gate figures a case varies; every other figure is empty. */
const buildRunOf = ({ runId, gates, verificationRepairs }: RunParams): BuildRun => ({
	manifest: runProgressManifestOf({ runId, status: RunStatus.Passed }),
	summary: {
		wallMs: 0,
		activeMs: 0,
		gateMs: 0,
		usage: undefined,
		cacheReadShare: undefined,
		steps: [],
		gates: { ...gates, reruns: 0, skipped: 0 },
		testResultExecutions: [],
		verificationRepairs,
		cleanup: undefined,
		rejectedReports: 0,
		frictionByArea: [],
	},
	runDir: `/repo/.lightsout/runs/${runId}`,
});

interface SetupParams {
	runs: RunParams[];
	going?: boolean;
}

const setupChecksSection = ({ runs, going = false }: SetupParams) => ({ runs: runs.map(buildRunOf), going });

describe('buildChecksSection', () => {
	test.each([
		{
			runs: [
				{
					runId: 'run-build',
					gates: { commands: 5, failed: 2, fixed: 1, selfChecks: 3 },
					verificationRepairs: [
						{ gateFamily: 'test', attempts: 2 },
						{ gateFamily: 'check', attempts: 1 },
					],
				},
				{
					runId: 'run-phase-1',
					gates: { commands: 2, failed: 0, fixed: 0, selfChecks: 1 },
					verificationRepairs: [
						{ gateFamily: 'build', attempts: 1 },
						{ gateFamily: 'test', attempts: 1 },
					],
				},
			],
			expected: {
				state: 'finished',
				gateRuns: { value: 7, provenance: 'measured' },
				failed: { value: 2, provenance: 'measured' },
				fixed: { value: 1, provenance: 'measured' },
				selfChecks: { value: 4, provenance: 'measured' },
				repairs: [
					{ gateFamily: 'test', attempts: { value: 3, provenance: 'measured' } },
					{ gateFamily: 'check', attempts: { value: 1, provenance: 'measured' } },
					{ gateFamily: 'build', attempts: { value: 1, provenance: 'measured' } },
				],
			},
		},
		{
			runs: [
				{ runId: 'run-build', gates: { commands: 0, failed: 0, fixed: 0, selfChecks: 0 }, verificationRepairs: [] },
				{ runId: 'run-phase-1', gates: { commands: 0, failed: 0, fixed: 0, selfChecks: 0 }, verificationRepairs: [] },
			],
			expected: undefined,
		},
	])('buildChecksSection: sums gate figures across the family, absent with no gate activity', ({ runs, expected }) => {
		const { runs: family, going } = setupChecksSection({ runs });

		const section = buildChecksSection({ runs: family, going });

		expect(section).toEqual(expected);
	});

	test('buildChecksSection: a build still going marks the section in progress', () => {
		const { runs, going } = setupChecksSection({
			runs: [{ runId: 'run-build', gates: { commands: 0, failed: 0, fixed: 0, selfChecks: 2 }, verificationRepairs: [] }],
			going: true,
		});

		const section = buildChecksSection({ runs, going });

		expect(section).toEqual({
			state: 'in-progress',
			gateRuns: { value: 0, provenance: 'measured' },
			failed: { value: 0, provenance: 'measured' },
			fixed: { value: 0, provenance: 'measured' },
			selfChecks: { value: 2, provenance: 'measured' },
			repairs: [],
		});
	});
});
