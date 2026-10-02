import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { readConfig } from '#src/common/config/readConfig.ts';
import type { LoadedConfig } from '#src/common/types/LoadedConfig.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import { RefactorWorklist } from '#src/contracts/refactor/RefactorWorklist.ts';
import type { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import { initializeRun } from '#src/refactor/initializeRun.ts';
import { readRunOwner } from '#src/runState/owner/readRunOwner.ts';
import { getRejectionError } from '#tests/helpers/getRejectionError.ts';
import { seedRunFolder } from '#tests/helpers/seedRunFolder.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';

const config: LightsoutConfig = { gates: { check: 'true', test: 'true', 'test-coverage': false }, 'standards-pack': 'lightsout/standards' };
const driver: Driver = { name: 'stub', invoke: async () => ({ text: '', exitCode: 0 }) };

const manifestWith = ({ pipeline }: { pipeline?: PipelineKind }): RunManifest => ({
	runId: 'run-1',
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:00.000Z',
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

/**
 * A committed repo whose one planted defect — a second export in a file — sits
 * inside a package under `packages/`, so what the run batches it under is
 * decided by the packages folder rather than by the top path segment.
 */
const setupPackageRepo = () =>
	setupConsumerRepo({ sources: { 'packages/web/src/config.js': 'export const readConfig = () => 1;\nexport const saveConfig = () => 2;\n' } });

/** The work-list a parked run froze, as it sits in the run's own folder. */
const frozenWorklist = { at: '2026-01-01T00:00:00.000Z', path: 'packages/web', all: true, batches: [] };

/**
 * A parked refactor run whose frozen work-list sits in the run's own folder,
 * while its manifest still records the flat path runs were filed under before
 * they moved under the work they belong to — so a resume that joined the
 * recorded path onto the checkout would open a file that is not there.
 */
const setupParkedRefactorRun = () => {
	const cwd = setupConsumerRepo();
	const runDir = seedRunFolder({ cwd, runId: 'run-1', pipeline: 'refactor' });

	writeFileSync(join(runDir, 'worklist.json'), `${JSON.stringify(frozenWorklist)}\n`, 'utf8');

	return { cwd };
};

/**
 * A parked refactor run whose owner record names a process long gone, beside an
 * implement run that holds no owner record at all — so a resume can be seen to
 * replace the one and leave the other untouched.
 */
const setupOwnedRuns = () => {
	const { cwd } = setupParkedRefactorRun();
	const refactorRunDir = seedRunFolder({ cwd, runId: 'run-1', pipeline: 'refactor' });

	writeFileSync(join(refactorRunDir, 'owner.json'), `${JSON.stringify({ pid: 999999, recordedAt: '2026-01-01T00:00:00.000Z' })}\n`, 'utf8');
	seedRunFolder({ cwd, runId: 'run-2', pipeline: 'implement' });

	return { cwd, implementManifest: { ...manifestWith({ pipeline: 'implement' }), runId: 'run-2' } };
};

/**
 * A clean repo for a fresh run beside a parked refactor run, each handed a
 * loaded config that differs from the stamped one in harness and gate — so a
 * fresh run can be seen to record the loaded config and a resume to ignore it.
 */
const setupLoadedConfigRuns = () => {
	const freshCwd = setupConsumerRepo();
	const { cwd: resumeCwd } = setupParkedRefactorRun();
	const loadedConfig: LoadedConfig = {
		config: { harness: 'codex', gates: { check: 'pnpm check', test: 'true', 'test-coverage': false } },
		path: join(freshCwd, 'lightsout.config.json'),
	};
	const existing = manifestWith({ pipeline: 'refactor' });

	return { freshCwd, resumeCwd, loadedConfig, existing };
};

/** The work-list the run froze into its run dir, read back through its contract. */
const readFrozenWorklist = ({ cwd, manifest }: { cwd: string; manifest: RunManifest }) =>
	RefactorWorklist.parse(JSON.parse(readFileSync(join(cwd, manifest.plan), 'utf8')));

describe('initializeRun', () => {
	test('refuses to resume a manifest the implement pipeline owns, naming the command that would', async () => {
		const cwd = setupConsumerRepo();

		const error = await getRejectionError({
			promise: initializeRun({ cwd, runId: 'run-1', driver, config, loadedConfig: { config }, existing: manifestWith({ pipeline: 'implement' }) }),
		});

		expect(error.message).toMatch(/belongs to the implement pipeline — resume it with: lightsout resume --run run-1/);
	});

	test('a manifest written before the pipeline field existed is treated as an implement run', async () => {
		const cwd = setupConsumerRepo();

		// pre-discriminator manifests carry no pipeline; assuming refactor would
		// let `lightsout refactor --run` hijack somebody's implement run
		const error = await getRejectionError({
			promise: initializeRun({ cwd, runId: 'run-1', driver, config, loadedConfig: { config }, existing: manifestWith({}) }),
		});

		expect(error.message).toMatch(/belongs to the implement pipeline/);
	});

	test("a resume reads the frozen work-list out of the run's own folder rather than the path the manifest records", async () => {
		const { cwd } = setupParkedRefactorRun();

		const { manifest, worklist } = await initializeRun({
			cwd,
			runId: 'run-2',
			driver,
			config,
			loadedConfig: { config },
			existing: manifestWith({ pipeline: 'refactor' }),
		});

		// the parked run is resumed with the list it froze — never a fresh check of the tree
		expect(manifest.runId).toBe('run-1');
		expect(worklist).toStrictEqual({ at: '2026-01-01T00:00:00.000Z', path: 'packages/web', all: true, batches: [] });
	});

	test('a fresh run computes the work-list from the tree and freezes the very list it returns', async () => {
		const cwd = setupPackageRepo();

		const { manifest, worklist } = await initializeRun({ cwd, runId: 'run-1', driver, config, loadedConfig: { config } });

		// the manifest points at the frozen file, and the frozen file is what the
		// caller got — resume re-reads this rather than checking the tree again
		expect(manifest.plan).toBe(join('.lightsout', 'refactor', 'runs', 'run-1', 'worklist.json'));
		expect(readFrozenWorklist({ cwd, manifest })).toEqual(worklist);
		// a run given no scope and no burn-down mode records both
		expect(worklist).toEqual(expect.objectContaining({ path: '.', all: false }));
	});

	test("batches a package's finding under the packages folder lightsout supplies when the config names none", async () => {
		const cwd = setupPackageRepo();

		// the run checks with the config it is handed, so it is handed the repo's
		// own, whose strict profile makes the planted defect blocking work
		const { worklist } = await initializeRun({
			cwd,
			runId: 'run-1',
			driver,
			config: await readConfig({ cwd }),
			loadedConfig: { config: await readConfig({ cwd }) },
		});

		const batch = worklist.batches.find((entry) => entry.rule === 'lightsout/multi-export');

		// 'packages/web' rather than 'packages': the area is the package, which it
		// can only be if the default packages folder is the one the engine's own
		// readers use — a second copy of the word here could disagree with them
		expect(batch?.folder).toBe('packages/web');
		expect(batch?.blocking.map((finding) => finding.siteKey)).toStrictEqual(['lightsout/multi-export:packages/web/src/config.js']);
	});

	test('reads the packages folder the config names, so a repo whose packages live elsewhere is batched by it', async () => {
		const cwd = setupPackageRepo();

		const { worklist } = await initializeRun({
			cwd,
			runId: 'run-1',
			driver,
			config: { ...(await readConfig({ cwd })), 'packages-dir': 'modules' },
			loadedConfig: { config: { ...(await readConfig({ cwd })), 'packages-dir': 'modules' } },
		});

		const batch = worklist.batches.find((entry) => entry.rule === 'lightsout/multi-export');

		// nothing sits under 'modules', so the planted file falls back to its top
		// segment — the configured folder is what decides, never the default
		expect(batch?.folder).toBe('packages');
	});

	test("replaces a resumed refactor run's owner record and writes nothing for another pipeline's run", async () => {
		const { cwd, implementManifest } = setupOwnedRuns();

		const [resumed, refused] = await Promise.allSettled([
			initializeRun({ cwd, runId: 'run-3', driver, config, loadedConfig: { config }, existing: manifestWith({ pipeline: 'refactor' }) }),
			initializeRun({ cwd, runId: 'run-4', driver, config, loadedConfig: { config }, existing: implementManifest }),
		]);
		const [refactorOwner, implementOwner] = await Promise.all([readRunOwner({ cwd, runId: 'run-1' }), readRunOwner({ cwd, runId: 'run-2' })]);

		// the resuming process now answers for the refactor run; the refused
		// implement run was never touched, so it still has no owner record
		expect({ resumed: resumed.status, refused: refused.status, implementOwner }).toStrictEqual({
			resumed: 'fulfilled',
			refused: 'rejected',
			implementOwner: undefined,
		});
		expect(refactorOwner).toEqual(expect.objectContaining({ pid: process.pid }));
	});

	test('a fresh refactor run records the loaded config and its path, and a resume keeps the recorded one', async () => {
		const { freshCwd, resumeCwd, loadedConfig, existing } = setupLoadedConfigRuns();

		const [fresh, resumed] = await Promise.all([
			initializeRun({ cwd: freshCwd, runId: 'run-1', driver, config, loadedConfig }),
			initializeRun({ cwd: resumeCwd, runId: 'run-2', driver, config, loadedConfig, existing }),
		]);

		// the fresh run records the config as read and the file it came from,
		// never the stamped one; the resume keeps exactly what its manifest recorded
		expect({
			freshConfig: fresh.manifest.config,
			freshConfigPath: fresh.manifest.configPath,
			resumedManifest: resumed.manifest,
		}).toStrictEqual({
			freshConfig: { harness: 'codex', gates: { check: 'pnpm check', test: 'true', 'test-coverage': false } },
			freshConfigPath: join(freshCwd, 'lightsout.config.json'),
			resumedManifest: manifestWith({ pipeline: 'refactor' }),
		});
	});
});
