import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { parseFlags } from '#src/cli/common/parseFlags.ts';
import { runBatchedCommand } from '#src/cli/common/runBatchedCommand/runBatchedCommand.ts';
import type { LoadedConfig } from '#src/common/types/LoadedConfig.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { RunLockError } from '#src/runState/lock/RunLockError.ts';
import { captureCommandOutput } from '#tests/helpers/captureCommandOutput.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';

const manifestOf = ({ status }: { status: RunStatus }): RunManifest => ({
	runId: 'run-42',
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:00.000Z',
	plan: '',
	harness: 'stub',
	status,
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

interface SeenStart {
	config?: LightsoutConfig;
	maxBatches?: number;
	existing?: unknown;
}

const setupShell = ({
	args = [],
	ok = true,
	status = RunStatus.Passed,
	failWith,
}: {
	args?: string[];
	ok?: boolean;
	status?: RunStatus;
	failWith?: Error;
} = {}) => {
	const result = { ok, manifest: manifestOf({ status }) };
	const captured = captureCommandOutput();
	const cwd = setupConsumerRepo();
	const seen: SeenStart = {};
	const printed: unknown[] = [];

	const command = runBatchedCommand({
		flags: parseFlags({ args }),
		cwd,
		command: 'refactor',
		run: async (start) => {
			seen.config = start.config;
			seen.maxBatches = start.maxBatches;
			seen.existing = start.existing;

			if (failWith) {
				throw failWith;
			}

			return result;
		},
		print: ({ result: finished }) => printed.push(finished),
	});

	return { command, cwd, seen, printed, ...captured };
};

/** Where the resumed run says its config came from — deliberately not the checkout the command runs in. */
const recordedConfigPath = '/elsewhere/launching-checkout/lightsout.config.json';

/**
 * A `--run` resume of a seeded refactor run. The checkout's own config file
 * carries a key this engine rejects, so any read of it fails the command — only
 * the config the run recorded on its manifest can get the run handed anything.
 */
const setupResumeShell = ({ recorded, recordsPath = true }: { recorded: Record<string, unknown> | undefined; recordsPath?: boolean }) => {
	const captured = captureCommandOutput();
	const cwd = setupConsumerRepo({ config: { 'not-a-setting': true } });
	const seeded: RunManifest = {
		...manifestOf({ status: RunStatus.Failed }),
		pipeline: 'refactor',
		harness: 'codex',
		config: recorded,
		configPath: recorded === undefined || !recordsPath ? undefined : recordedConfigPath,
	};
	const runDir = runDirFor({ cwd, runId: seeded.runId, pipeline: 'refactor' });

	mkdirSync(runDir, { recursive: true });
	writeFileSync(join(runDir, 'manifest.json'), JSON.stringify(seeded));

	const seen: { config?: LightsoutConfig; existingRunId?: string } = {};

	const command = runBatchedCommand({
		flags: parseFlags({ args: ['--run', seeded.runId] }),
		cwd,
		command: 'refactor',
		run: async (start) => {
			seen.config = start.config;
			seen.existingRunId = start.existing?.runId;

			return { ok: true, manifest: manifestOf({ status: RunStatus.Passed }) };
		},
		print: () => undefined,
	});

	return { command, seen, ...captured };
};

/** The config a resumed run recorded, deliberately unlike the checkout's file it is resumed from. */
const recordedConfig: LightsoutConfig = { harness: 'codex', gates: { check: 'recorded-check', test: 'true', 'test-coverage': false } };

/**
 * A refactor run started fresh, or resumed with `--run` from a seeded manifest
 * recording `recordedConfig` at `recordedConfigPath`. Either way the checkout's
 * own file is a valid one whose check gate reads 'checkout-file-check', so a
 * resume that read the file would hand the run its contents.
 */
const setupLoadedConfigShell = ({ resume = false }: { resume?: boolean } = {}) => {
	const captured = captureCommandOutput();
	const cwd = setupConsumerRepo({ scripts: { check: 'checkout-file-check' }, config: { 'standards-pack': false } });
	const seeded: RunManifest = {
		...manifestOf({ status: RunStatus.Failed }),
		pipeline: 'refactor',
		harness: 'codex',
		config: recordedConfig,
		configPath: recordedConfigPath,
	};

	if (resume) {
		const runDir = runDirFor({ cwd, runId: seeded.runId, pipeline: 'refactor' });

		mkdirSync(runDir, { recursive: true });
		writeFileSync(join(runDir, 'manifest.json'), JSON.stringify(seeded));
	}

	const seen: { loadedConfig?: LoadedConfig } = {};

	const command = runBatchedCommand({
		flags: parseFlags({ args: resume ? ['--run', seeded.runId] : [] }),
		cwd,
		command: 'refactor',
		run: async (start) => {
			seen.loadedConfig = start.loadedConfig;

			return { ok: true, manifest: manifestOf({ status: RunStatus.Passed }) };
		},
		print: () => undefined,
	});

	return { command, cwd, seen, ...captured };
};

describe('runBatchedCommand', () => {
	test('resolves the effective config, announces the run, hands off, prints the result, and exits 0 on ok', async () => {
		const { command, cwd, seen, printed, logged, exitCodes } = setupShell({ args: ['--max-batches', '2'] });

		await expect(command).rejects.toThrow(/process\.exit/);

		expect(seen.config?.harness).toBe('claude-code');
		expect(seen.maxBatches).toBe(2);
		expect(seen.existing).toBeUndefined();
		expect(logged[0]).toBe('lightsout: refactor starting run');
		expect(logged[1]).toBe(`  config: ${join(cwd, 'lightsout.config.json')}`);
		expect(printed).toStrictEqual([{ ok: true, manifest: manifestOf({ status: RunStatus.Passed }) }]);
		expect(exitCodes).toStrictEqual([0]);
	});

	test('a run that broke exits 1, whatever it managed along the way', async () => {
		const { command, exitCodes } = setupShell({ ok: false, status: RunStatus.Failed });

		await expect(command).rejects.toThrow(/process\.exit/);

		expect(exitCodes).toStrictEqual([1]);
	});

	test('a run that stopped at its ceiling exits 2, so a caller can tell it apart from one that broke', async () => {
		const { command, exitCodes } = setupShell({ ok: false, status: RunStatus.PausedBudget });

		await expect(command).rejects.toThrow(/process\.exit/);

		expect(exitCodes).toStrictEqual([2]);
	});

	test('a run parked at a rate-limit wall exits 2 as well — it is waiting, not broken', async () => {
		const { command, exitCodes } = setupShell({ ok: false, status: RunStatus.PausedRateLimit });

		await expect(command).rejects.toThrow(/process\.exit/);

		expect(exitCodes).toStrictEqual([2]);
	});

	test('a --max-batches below one is rejected before the pipeline is asked to do anything', async () => {
		const { command, seen, errors, exitCodes } = setupShell({ args: ['--max-batches', '0'] });

		await expect(command).rejects.toThrow(/process\.exit/);

		expect(errors.join('\n')).toContain(`--max-batches must be a positive integer, got '0'`);
		expect(seen.config).toBeUndefined();
		expect(exitCodes).toStrictEqual([1]);
	});

	test('a lock collision is reported in the lock’s own words, not as a crash', async () => {
		const { command, errors, exitCodes } = setupShell({ failWith: new RunLockError('run 9f2 is already running in this repo (pid 4242)') });

		await expect(command).rejects.toThrow(/process\.exit/);

		expect(errors.join('\n')).toContain('run 9f2 is already running in this repo (pid 4242)');
		expect(exitCodes).toStrictEqual([1]);
	});

	test("a --run resume hands the run its recorded config with this command's harness applied, never the checkout's file", async () => {
		const { command, seen, logged, exitCodes } = setupResumeShell({
			recorded: { harness: 'codex', gates: { check: 'true', test: 'true', 'test-coverage': false } },
		});

		await expect(command).rejects.toThrow(/process\.exit/);

		expect({
			harness: seen.config?.harness,
			gates: seen.config?.gates,
			existingRunId: seen.existingRunId,
			configLine: logged.includes(`  config: ${recordedConfigPath}`),
			exitCodes,
		}).toStrictEqual({
			harness: 'codex',
			gates: { check: 'true', test: 'true', 'test-coverage': false },
			existingRunId: 'run-42',
			configLine: true,
			exitCodes: [0],
		});
	});

	test('a --run resume whose manifest records no config is refused before the run is handed anything', async () => {
		const { command, seen, logged, errors, exitCodes } = setupResumeShell({ recorded: undefined });

		await expect(command).rejects.toThrow(/process\.exit/);

		expect({
			namesRun: errors.some((entry) => entry.includes('run-42')),
			handedConfig: seen.config,
			resumingBanner: logged.some((line) => line.includes('resuming run')),
			exitCodes,
		}).toStrictEqual({ namesRun: true, handedConfig: undefined, resumingBanner: false, exitCodes: [1] });
	});

	test('a --run resume of a run that predates the recorded path prints no config line rather than claiming the checkout has none', async () => {
		const { command, seen, logged, exitCodes } = setupResumeShell({
			recorded: { gates: { check: 'true', test: 'true', 'test-coverage': false } },
			recordsPath: false,
		});

		await expect(command).rejects.toThrow(/process\.exit/);

		expect({
			banner: logged[0],
			configLines: logged.filter((line) => line.startsWith('  config:')),
			gates: seen.config?.gates,
			exitCodes,
		}).toStrictEqual({
			banner: 'lightsout: refactor resuming run run-42',
			configLines: [],
			gates: { check: 'true', test: 'true', 'test-coverage': false },
			exitCodes: [0],
		});
	});

	test('a fresh run is handed the config as read and its absolute path', async () => {
		const { command, cwd, seen, exitCodes } = setupLoadedConfigShell();

		await expect(command).rejects.toThrow(/process\.exit/);

		expect({ loadedConfig: seen.loadedConfig, exitCodes }).toStrictEqual({
			loadedConfig: {
				config: { gates: { check: 'checkout-file-check', test: 'true', 'test-coverage': false }, 'standards-pack': false },
				path: join(cwd, 'lightsout.config.json'),
			},
			exitCodes: [0],
		});
	});

	test('a resumed run is handed the recorded config and its recorded path', async () => {
		const { command, seen, exitCodes } = setupLoadedConfigShell({ resume: true });

		await expect(command).rejects.toThrow(/process\.exit/);

		expect({ loadedConfig: seen.loadedConfig, exitCodes }).toStrictEqual({
			loadedConfig: {
				config: { harness: 'codex', gates: { check: 'recorded-check', test: 'true', 'test-coverage': false } },
				path: '/elsewhere/launching-checkout/lightsout.config.json',
			},
			exitCodes: [0],
		});
	});
});
