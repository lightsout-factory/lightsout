import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { resumeCommand } from '#src/cli/resumeCommand/resumeCommand.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';
import { manifestOf, runId, setupResume } from '#tests/helpers/setupResume.ts';

// Mocked Imports
// -------------------------
// Whether the pre-source lifecycle write can be made — and whether a gate hold
// stands against the ticket — is the guard's own contract, tested beside it.
// What this file pins is what resume does with the guard's answer. Every other
// lifecycle export stays real.
interface GuardParams {
	cwd: string;
	config: LightsoutConfig;
	env: NodeJS.ProcessEnv;
	ticketRef?: string;
	onProgress?: (message: string) => void;
}

const mockRequireImplementLifecycle = jest.fn<(params: GuardParams) => Promise<string | undefined>>();

jest.mock('#src/ticketLifecycle/requireImplementLifecycle.ts', () => ({
	requireImplementLifecycle: (params: GuardParams) => mockRequireImplementLifecycle(params),
}));
// -------------------------

/** A config this engine accepts, standing for the one a run recorded when it started. */
const recordedConfig = { gates: { check: 'true', test: 'true', 'test-coverage': false }, 'standards-pack': false };

/** A seeded run's manifest exactly as its bytes stand on disk, so a refusal can be shown to have written nothing. */
const readManifestText = ({ cwd, id }: { cwd: string; id: string }): string => readFileSync(join(runDirFor({ cwd, runId: id }), 'manifest.json'), 'utf8');

/** A config path that lies outside every checkout a case seeds, so a header naming it can only have read it off the manifest. */
const recordedConfigPath = join(tmpdir(), 'lightsout-recorded-elsewhere', 'lightsout.config.json');

/**
 * A seeded implement run whose manifest carries what the case records about its
 * config, launched from a checkout whose own file holds `fileConfig`. The guard
 * is answered `undefined`, so the lifecycle write is never the reason a case
 * stops; the seeded plan does not exist, so a resume that gets going stops at
 * the plan read.
 */
const setupRecordedConfigResume = ({ recorded, fileConfig }: { recorded: Partial<RunManifest>; fileConfig?: Record<string, unknown> }) => {
	mockRequireImplementLifecycle.mockResolvedValue(undefined);

	const seeded = setupResume({ args: ['--run', runId], manifest: manifestOf({ pipeline: 'implement', willShip: true, ...recorded }), config: fileConfig });

	return { ...seeded, manifestBefore: readManifestText({ cwd: seeded.cwd, id: runId }) };
};

describe('resumeCommand', () => {
	test("resume continues on the config the run recorded even when the launching checkout's file no longer parses", async () => {
		const { context, logged, errors } = setupRecordedConfigResume({
			recorded: { config: recordedConfig, configPath: recordedConfigPath },
			fileConfig: { 'not-a-config-key': true },
		});

		await expect(resumeCommand(context)).rejects.toThrow(/process\.exit/);

		expect(logged[0]).toBe(`lightsout: resuming run ${runId} (was: failed, plan: ghost.md)`);
		expect(logged).toContain('  repo root: none (standards-pack false)');
		// the file was never read, so its validation failure appears nowhere
		expect(errors.join('\n')).not.toMatch(/is not valid|not-a-config-key/u);
	});

	test("resume hands the lifecycle guard the config the run recorded, not the launching checkout's file", async () => {
		const { context } = setupRecordedConfigResume({
			recorded: { config: { ...recordedConfig, 'agent-commands': ['pnpm db:migrate'] }, configPath: recordedConfigPath },
		});

		await expect(resumeCommand(context)).rejects.toThrow(/process\.exit/);

		expect(mockRequireImplementLifecycle).toHaveBeenCalledWith(
			expect.objectContaining({ config: expect.objectContaining({ 'agent-commands': ['pnpm db:migrate'] }) }),
		);
	});

	test('resume refuses a run that recorded no config before the guard runs or the manifest is restamped', async () => {
		const { context, cwd, logged, errors, exitCodes, manifestBefore } = setupRecordedConfigResume({ recorded: { config: undefined } });

		await expect(resumeCommand(context)).rejects.toThrow(/process\.exit/);

		const manifestAfter = readManifestText({ cwd, id: runId });

		expect({ lines: errors.length, namesRun: errors[0]?.includes(runId) }).toStrictEqual({ lines: 1, namesRun: true });
		expect(exitCodes).toStrictEqual([1]);
		expect(logged).toStrictEqual([]);
		expect(mockRequireImplementLifecycle).not.toHaveBeenCalled();
		expect(manifestAfter).toBe(manifestBefore);
	});

	test('resume refuses a run whose recorded config this engine rejects, naming the offending key', async () => {
		const { context, logged, errors, exitCodes } = setupRecordedConfigResume({
			recorded: { config: { ...recordedConfig, 'not-a-config-key': true }, configPath: recordedConfigPath },
		});

		await expect(resumeCommand(context)).rejects.toThrow(/process\.exit/);

		expect(errors.some((entry) => entry.includes(runId) && entry.includes('not-a-config-key'))).toBe(true);
		expect(exitCodes).toStrictEqual([1]);
		expect(logged).toStrictEqual([]);
		expect(mockRequireImplementLifecycle).not.toHaveBeenCalled();
	});

	test("the resume header names the config path the run recorded, not the launching checkout's file", async () => {
		const { context, cwd, logged } = setupRecordedConfigResume({ recorded: { config: recordedConfig, configPath: recordedConfigPath } });

		await expect(resumeCommand(context)).rejects.toThrow(/process\.exit/);

		expect(logged).toContain(`  config: ${recordedConfigPath}`);
		expect(logged.some((line) => line.includes(join(cwd, 'lightsout.config.json')))).toBe(false);
	});

	test('a resumed run that predates the recorded path resumes with no config line rather than claiming its checkout has no config', async () => {
		const { context, logged } = setupRecordedConfigResume({ recorded: { config: recordedConfig, configPath: undefined } });

		await expect(resumeCommand(context)).rejects.toThrow(/process\.exit/);

		expect(logged[0]).toBe(`lightsout: resuming run ${runId} (was: failed, plan: ghost.md)`);
		expect(logged.some((line) => line.startsWith('  config:'))).toBe(false);
	});
});
