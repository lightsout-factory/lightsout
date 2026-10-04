import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { resumeCommand } from '#src/cli/resumeCommand.ts';
import type { LoadedConfig } from '#src/common/types/LoadedConfig.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { PipelineResult } from '#src/pipeline/PipelineResult.ts';
import { manifestOf, runId, setupResume } from '#tests/helpers/setupResume.ts';
import { writeRepoFile } from '#tests/helpers/writeRepoFile.ts';

// Mocked Imports
// -------------------------
// What this file pins is the loaded config a resume hands the pipeline it
// continues: the run's recorded config and recorded path, never the launching
// checkout's file. Each pipeline door spawns a harness, so each is doubled and
// its arguments are the observable result; the direct door is doubled one level
// down, at runDirectWork, so the hand-off through continueDirectRun stays real.
type PipelineParams = { cwd: string; existing?: RunManifest; loadedConfig?: LoadedConfig };
type DirectWorkParams = { cwd: string; ticketBody: string; ticketRef: string; existing?: RunManifest; loadedConfig?: LoadedConfig };
type GuardParams = { cwd: string; config: LightsoutConfig; env: NodeJS.ProcessEnv; ticketRef?: string; onProgress?: (message: string) => void };
type ShipAfterImplementParams = {
	config: LightsoutConfig;
	cwd: string;
	result: PipelineResult;
	shipFlag: boolean;
	noShipFlag: boolean;
	env: NodeJS.ProcessEnv;
};

const mockRunPipelineOrFailFast = jest.fn<(params: PipelineParams) => Promise<PipelineResult>>();

jest.mock('#src/cli/internal/common/utils/runPipelineOrFailFast.ts', () => ({
	runPipelineOrFailFast: (params: PipelineParams) => mockRunPipelineOrFailFast(params),
}));
// -------------------------
const mockRunPhasesOrFailFast = jest.fn<(params: PipelineParams) => Promise<PipelineResult>>();

jest.mock('#src/cli/internal/common/utils/runPhasesOrFailFast.ts', () => ({
	runPhasesOrFailFast: (params: PipelineParams) => mockRunPhasesOrFailFast(params),
}));
// -------------------------
const mockRunDirectWork = jest.fn<(params: DirectWorkParams) => Promise<PipelineResult>>();

jest.mock('#src/direct/runDirectWork/runDirectWork.ts', () => ({ runDirectWork: (params: DirectWorkParams) => mockRunDirectWork(params) }));
// -------------------------
const mockRequireImplementLifecycle = jest.fn<(params: GuardParams) => Promise<string | undefined>>();

jest.mock('#src/ticketLifecycle/requireImplementLifecycle.ts', () => ({
	requireImplementLifecycle: (params: GuardParams) => mockRequireImplementLifecycle(params),
}));
// -------------------------
const mockShipAfterImplement = jest.fn<(params: ShipAfterImplementParams) => Promise<number>>();

jest.mock('#src/cli/internal/common/utils/shipAfterImplement.ts', () => ({
	shipAfterImplement: (params: ShipAfterImplementParams) => mockShipAfterImplement(params),
}));
// -------------------------

/** The config the run recorded when it started — accepted by this engine, and unlike the file the checkout holds now. */
const recordedConfig = { gates: { check: 'echo recorded', test: 'true', 'test-coverage': false }, 'standards-pack': false };

/** What the launching checkout's lightsout.config.json says since it was rewritten after the run started. */
const editedFileConfig = { gates: { check: 'echo edited', test: 'true', 'test-coverage': false }, 'standards-pack': false };

/** A config path outside every checkout a case seeds, so a loaded config naming it can only have read it off the manifest. */
const recordedConfigPath = join(tmpdir(), 'lightsout-recorded-elsewhere', 'lightsout.config.json');

/** The ticket body a direct run froze beside itself, relative to the checkout its records live in. */
const frozenTicketPath = join('.lightsout', 'direct', 'runs', runId, 'ticket.md');

/**
 * A parked run of `pipeline` that recorded `recordedConfig` and `configPath`,
 * launched from a checkout whose file has since been rewritten. The manifest
 * records no workspace, so the continuation builds in the launching checkout,
 * and a direct run's frozen ticket sits beside its manifest.
 * Every door answers a stopped run, so nothing past the hand-off ships.
 */
const setupRecordedResume = ({ pipeline, configPath }: { pipeline: PipelineKind; configPath: string | undefined }) => {
	const plan = pipeline === PipelineKind.Direct ? frozenTicketPath : 'plan.md';
	const seeded = setupResume({
		args: ['--run', runId],
		manifest: manifestOf({ pipeline, status: RunStatus.Failed, plan, ticketRef: 'lo-188', config: recordedConfig, configPath }),
		config: editedFileConfig,
	});
	const stopped: PipelineResult = { ok: false, manifest: manifestOf({ pipeline, status: RunStatus.Failed, plan }), error: 'stopped by the test' };

	// only a direct run freezes its ticket: the folder it lands in would otherwise
	// be a second run folder answering to the same id
	if (pipeline === PipelineKind.Direct) {
		writeRepoFile({ cwd: seeded.cwd, path: frozenTicketPath, content: '# Read config once\n\nBuild the thing.\n' });
	}

	mockRequireImplementLifecycle.mockResolvedValue(undefined);
	mockShipAfterImplement.mockResolvedValue(1);
	mockRunPipelineOrFailFast.mockResolvedValue(stopped);
	mockRunPhasesOrFailFast.mockResolvedValue(stopped);
	mockRunDirectWork.mockResolvedValue(stopped);

	return seeded;
};

/** The loaded config each door was handed, one entry per call, so a case can state which door ran and with what. */
const handedLoadedConfigs = () => ({
	implement: mockRunPipelineOrFailFast.mock.calls.map(([params]) => params.loadedConfig),
	phases: mockRunPhasesOrFailFast.mock.calls.map(([params]) => params.loadedConfig),
	direct: mockRunDirectWork.mock.calls.map(([params]) => params.loadedConfig),
});

describe('resumeCommand', () => {
	test.each([
		{
			pipeline: PipelineKind.Implement,
			expected: { implement: [{ config: recordedConfig, path: recordedConfigPath }], phases: [], direct: [] },
		},
		{
			pipeline: PipelineKind.Phases,
			expected: { implement: [], phases: [{ config: recordedConfig, path: recordedConfigPath }], direct: [] },
		},
	])('a resumed implement or phases run is handed the recorded config and path', async ({ pipeline, expected }) => {
		const { context } = setupRecordedResume({ pipeline, configPath: recordedConfigPath });

		await expect(resumeCommand(context)).rejects.toThrow(/process\.exit/);

		expect(handedLoadedConfigs()).toStrictEqual(expected);
	});

	test('a resumed direct run is handed the recorded config and path', async () => {
		const { context } = setupRecordedResume({ pipeline: PipelineKind.Direct, configPath: recordedConfigPath });

		await expect(resumeCommand(context)).rejects.toThrow(/process\.exit/);

		expect(handedLoadedConfigs()).toStrictEqual({ implement: [], phases: [], direct: [{ config: recordedConfig, path: recordedConfigPath }] });
	});

	test('a resume of a manifest with no recorded path hands on no path', async () => {
		const { context } = setupRecordedResume({ pipeline: PipelineKind.Implement, configPath: undefined });

		await expect(resumeCommand(context)).rejects.toThrow(/process\.exit/);

		// the launching checkout holds a config file, so a path resolved from it
		// would be defined here: an undefined path can only be the manifest's own
		const handed = mockRunPipelineOrFailFast.mock.calls.map(([params]) => ({ config: params.loadedConfig?.config, path: params.loadedConfig?.path }));

		expect(handed).toStrictEqual([{ config: recordedConfig, path: undefined }]);
	});
});
