import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@jest/globals';
import type { Driver } from '#src/common/types/Driver.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { PipelineRun } from '#src/pipeline/common/PipelineRun.ts';
import { buildCleanupRecord } from '#src/pipeline/steps/common/buildCleanupRecord.ts';
import { createRun } from '#src/runState/createRun.ts';
import { sourceFileGlobs } from '#tests/helpers/sourceFileGlobs.ts';
import { testFileGlobs } from '#tests/helpers/testFileGlobs.ts';

const config: LightsoutConfig = {
	'source-files': sourceFileGlobs,
	'test-files': testFileGlobs,
	gates: { check: 'true', test: 'true', 'test-coverage': false },
};
const idleDriver: Driver = { name: 'stub', invoke: async () => ({ text: '', exitCode: 0 }) };

const setupCleanupRecord = async ({ targeted }: { targeted: StandardsFinding[] }) => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-cleanup-record-'));
	const manifest = await createRun({ cwd, plan: 'plan.md', pipeline: 'implement', driver: idleDriver.name, loadedConfig: { config } });
	const run = new PipelineRun({ cwd, config, driver: idleDriver, manifest, onProgress: () => undefined });
	const context = {
		run,
		planContent: '',
		groups: [],
		baseline: undefined,
		budget: 3,
		before: {},
		initialReview: [],
	};
	const state = {
		record: { id: 'refactor', status: RunStatus.Running, attempts: 1 },
		roundsUsed: 1,
		edited: [],
		failures: [],
		remaining: [],
		inherited: [],
		uncertain: [],
		finalReview: [],
		targeted,
	};

	return { context, state };
};

test.each([
	{
		targeted: [
			{
				rule: 'acme/max-nesting',
				severity: StandardsSeverity.Blocking,
				siteKey: 'acme/max-nesting:src/a.ts',
				files: [{ path: 'src/a.ts' }],
				detail: 'nesting depth 5',
			},
			{
				rule: 'acme/file-size',
				severity: StandardsSeverity.Blocking,
				siteKey: 'acme/file-size:src/b.ts',
				files: [{ path: 'src/b.ts' }],
				detail: '412 lines',
			},
		],
	},
	{ targeted: [] },
])('buildCleanupRecord: writes the targeted findings, an empty list included', async ({ targeted }) => {
	const { context, state } = await setupCleanupRecord({ targeted });

	const record = buildCleanupRecord({ context, state });

	expect(record.report).toEqual(expect.objectContaining({ targeted }));
});
