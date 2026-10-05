import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { z } from 'zod';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { readRunOwner } from '#src/runState/owner/readRunOwner.ts';
import { resumeWorklistRun } from '#src/runState/resumeWorklistRun.ts';
import { seedRunFolder } from '#tests/helpers/seedRunFolder.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';

const config: LightsoutConfig = { gates: { check: 'true', test: 'true', 'test-coverage': false } };
const Worklist = z.object({ batches: z.array(z.string()) });

const manifestWith = ({ pipeline }: { pipeline?: PipelineKind }): RunManifest => ({
	runId: 'run-1',
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:00.000Z',
	// The flat path runs were filed under before they moved under their pipeline.
	plan: '.lightsout/runs/run-1/worklist.json',
	pipeline,
	harness: 'stub',
	config,
	status: RunStatus.PausedRateLimit,
	currentStep: null,
	steps: [],
	changedFiles: [],
	commits: [],
	packages: [],
	baselineDirtyFiles: [],
	testSubjects: [],
	acceptanceTests: [],
	approvedTests: [],
	unreachableChangedFiles: [],
	coverageExcludedChangedFiles: [],
});

/** A parked refactor run whose frozen worklist sits in the run's own folder. */
const setupParkedRun = () => {
	const cwd = setupConsumerRepo();
	const runDir = seedRunFolder({ cwd, runId: 'run-1', pipeline: 'refactor' });

	writeFileSync(join(runDir, 'worklist.json'), `${JSON.stringify({ batches: ['batch-01'] })}\n`, 'utf8');

	return { cwd };
};

describe('resumeWorklistRun', () => {
	test('answers the worklist frozen in the run folder, wherever the manifest says it was filed', async () => {
		const { cwd } = setupParkedRun();

		const worklist = await resumeWorklistRun({
			cwd,
			existing: manifestWith({ pipeline: PipelineKind.Refactor }),
			pipeline: PipelineKind.Refactor,
			contract: Worklist,
		});

		expect(worklist).toStrictEqual({ batches: ['batch-01'] });
	});

	test('records this process as the owner of the resumed run', async () => {
		const { cwd } = setupParkedRun();

		await resumeWorklistRun({ cwd, existing: manifestWith({ pipeline: PipelineKind.Refactor }), pipeline: PipelineKind.Refactor, contract: Worklist });

		expect(await readRunOwner({ cwd, runId: 'run-1' })).toEqual(expect.objectContaining({ pid: process.pid }));
	});

	test.each([
		{
			named: 'a run of another pipeline is refused with the command that resumes it',
			pipeline: PipelineKind.Coverage,
			expected: /belongs to the coverage pipeline — resume it with: /,
		},
		{ named: 'a run that records no pipeline is taken for an implement run', pipeline: undefined, expected: /belongs to the implement pipeline/ },
	])('$named', async ({ pipeline, expected }) => {
		const { cwd } = setupParkedRun();

		const resumed = resumeWorklistRun({ cwd, existing: manifestWith({ pipeline }), pipeline: PipelineKind.Refactor, contract: Worklist });

		await expect(resumed).rejects.toThrow(expected);
	});
});
