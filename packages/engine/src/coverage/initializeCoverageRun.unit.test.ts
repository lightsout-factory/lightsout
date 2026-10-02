import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { readConfig } from '#src/common/config/readConfig.ts';
import type { LoadedConfig } from '#src/common/types/LoadedConfig.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { initializeCoverageRun } from '#src/coverage/initializeCoverageRun.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import { getRunOwnerPath } from '#src/runState/owner/getRunOwnerPath.ts';
import { readRunOwner } from '#src/runState/owner/readRunOwner.ts';
import { readRunManifest } from '#src/runState/readRunManifest.ts';
import { getRejectionError } from '#tests/helpers/getRejectionError.ts';
import { seedRunFolder } from '#tests/helpers/seedRunFolder.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';

const driver: Driver = { name: 'stub', invoke: async () => ({ text: '', exitCode: 0 }) };

const manifestWith = ({ pipeline, config }: { pipeline?: PipelineKind; config: LightsoutConfig }): RunManifest => ({
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

/** A measurable consumer repo: a coverage command that exits green and a summary already on disk. */
const setupMeasurable = ({ git = true }: { git?: boolean } = {}) => {
	const dir = setupConsumerRepo({ git: false, scripts: { 'test-coverage': 'true' } });

	mkdirSync(join(dir, 'coverage'), { recursive: true });
	writeFileSync(
		join(dir, 'coverage/coverage-summary.json'),
		JSON.stringify({ total: { statements: { pct: 61 } }, [join(dir, 'src/index.js')]: { statements: { pct: 12 } } }),
	);

	if (git) {
		execSync(
			'git init -q && git config user.name t && git config user.email t@t && printf "coverage\\n" > .gitignore && git add -A && git -c user.name=t -c user.email=t@t commit -qm init',
			{ cwd: dir },
		);
	}

	return dir;
};

/** A monorepo whose root coverage gate is off but whose packages each measure themselves. */
const setupScopedMeasurable = () => {
	const dir = setupConsumerRepo({
		git: false,
		config: { 'package-gates': { check: 'true {package}', test: 'true {package}', 'test-coverage': 'true {package}' } },
	});

	mkdirSync(join(dir, 'packages/api/coverage'), { recursive: true });
	writeFileSync(join(dir, 'packages/api/package.json'), JSON.stringify({ name: '@acme/api' }));
	writeFileSync(
		join(dir, 'packages/api/coverage/coverage-summary.json'),
		JSON.stringify({ total: { statements: { pct: 43 } }, [join(dir, 'packages/api/src/a.ts')]: { statements: { pct: 7 } } }),
	);

	execSync(
		'git init -q && git config user.name t && git config user.email t@t && printf "coverage\\n" > .gitignore && git add -A && git -c user.name=t -c user.email=t@t commit -qm init',
		{ cwd: dir },
	);

	return dir;
};

/**
 * A measured run frozen in a primary checkout, and a linked worktree of that
 * same repository to resume it from — which is where joining the recorded plan
 * path onto `cwd` and reading the run's own folder stop naming the same file.
 */
const setupWorktreeResume = async () => {
	const cwd = setupMeasurable();
	const config = await readConfig({ cwd });
	const fresh = await initializeCoverageRun({ cwd, runId: 'run-1', driver, config, loadedConfig: { config } });
	const worktree = join(mkdtempSync(join(tmpdir(), 'lightsout-coverage-worktree-')), 'linked');

	execSync(`git worktree add -q "${worktree}" -b resume-from-here`, { cwd });

	return { config, fresh, worktree };
};

/**
 * A measured coverage run whose owner record names a process that is long
 * gone, beside an implement run's folder that holds no owner record at all.
 */
const setupOwnedResume = async () => {
	const cwd = setupMeasurable();
	const config = await readConfig({ cwd });

	// seeded before the coverage run exists, so the run lookup finds both folders
	seedRunFolder({ cwd, runId: 'run-implement', pipeline: 'implement' });

	const fresh = await initializeCoverageRun({ cwd, runId: 'run-1', driver, config, loadedConfig: { config } });

	writeFileSync(await getRunOwnerPath({ cwd, runId: 'run-1' }), JSON.stringify({ pid: 999999, recordedAt: '2026-01-01T00:00:00.000Z' }));

	const implementRun: RunManifest = { ...manifestWith({ pipeline: PipelineKind.Implement, config }), runId: 'run-implement' };

	return { cwd, config, fresh, implementRun };
};

/**
 * A fresh coverage run started with a stamped config whose harness and model
 * differ from the config as read, and a second loaded config — another file,
 * another harness — that a resume of that run is handed.
 */
const setupLoadedConfigResume = async () => {
	const cwd = setupMeasurable();
	const config = await readConfig({ cwd });
	const loadedConfig: LoadedConfig = { config, path: join(cwd, 'lightsout.config.json') };
	const stamped: LightsoutConfig = { ...config, harness: 'stamped-harness', model: 'stamped-model' };
	const fresh = await initializeCoverageRun({ cwd, runId: 'run-1', driver, config: stamped, loadedConfig });
	const resumeLoadedConfig: LoadedConfig = { config: { ...config, harness: 'edited-harness' }, path: '/elsewhere/lightsout.config.json' };
	// the manifest records plain data, so its on-disk form is the config's JSON round-trip
	const recordedConfig: unknown = JSON.parse(JSON.stringify(config));

	return { cwd, stamped, fresh, resumeLoadedConfig, recordedConfig, configPath: loadedConfig.path };
};

describe('initializeCoverageRun', () => {
	test('a config that opted out of the coverage gate is refused before any run state exists', async () => {
		const cwd = setupConsumerRepo();

		const error = await getRejectionError({
			promise: initializeCoverageRun({ cwd, runId: 'run-1', driver, config: await readConfig({ cwd }), loadedConfig: { config: await readConfig({ cwd }) } }),
		});

		// the command has nothing to run, and silently skipping would look like success
		expect(error.message).toMatch(/opted out \("test-coverage": false\) — test-coverage-to-threshold has nothing to run/);
	});

	test('a per-package coverage gate keeps the run alive even with the root gate switched off', async () => {
		const cwd = setupScopedMeasurable();

		const { worklist } = await initializeCoverageRun({
			cwd,
			runId: 'run-1',
			driver,
			config: await readConfig({ cwd }),
			loadedConfig: { config: await readConfig({ cwd }) },
		});

		// a monorepo measures per package — the root gate being off is not an opt-out
		expect(worklist.totals).toStrictEqual([{ scope: 'api', statementsPct: 43, passed: true }]);
	});

	test('without git the run refuses to start, because its diff could never be attributed', async () => {
		const cwd = setupMeasurable({ git: false });

		const error = await getRejectionError({
			promise: initializeCoverageRun({ cwd, runId: 'run-1', driver, config: await readConfig({ cwd }), loadedConfig: { config: await readConfig({ cwd }) } }),
		});

		expect(error.message).toMatch(/requires a git worktree/);
	});

	test('a dirty tree is a hard error naming what is dirty', async () => {
		const cwd = setupMeasurable();

		writeFileSync(join(cwd, 'src/uncommitted.js'), 'export const later = 1;\n');

		const error = await getRejectionError({
			promise: initializeCoverageRun({ cwd, runId: 'run-1', driver, config: await readConfig({ cwd }), loadedConfig: { config: await readConfig({ cwd }) } }),
		});

		expect(error.message).toMatch(/requires a clean tree/);
		expect(error.message).toContain('src/uncommitted.js');
	});

	test('allowDirty records the standing dirt as baseline instead of refusing the run', async () => {
		const cwd = setupMeasurable();

		writeFileSync(join(cwd, 'src/uncommitted.js'), 'export const later = 1;\n');

		const { manifest } = await initializeCoverageRun({
			cwd,
			runId: 'run-1',
			driver,
			config: await readConfig({ cwd }),
			loadedConfig: { config: await readConfig({ cwd }) },
			allowDirty: true,
		});

		// frozen into the manifest, so batch attribution can never claim it
		expect(manifest.baselineDirtyFiles).toStrictEqual(['src/uncommitted.js']);
	});

	test('a fresh run freezes the initial measurement and stamps the manifest as this pipeline', async () => {
		const cwd = setupMeasurable();

		const { manifest, worklist } = await initializeCoverageRun({
			cwd,
			runId: 'run-1',
			driver,
			config: await readConfig({ cwd }),
			loadedConfig: { config: await readConfig({ cwd }) },
		});

		expect(manifest.pipeline).toBe('coverage');
		expect(manifest.plan).toBe(join('.lightsout', 'coverage', 'runs', 'run-1', 'worklist.json'));
		expect(worklist.totals).toStrictEqual([{ scope: 'root', statementsPct: 61, passed: true }]);
		// the frozen file is the before side of the final report — resume re-reads it
		expect(JSON.parse(readFileSync(join(cwd, manifest.plan), 'utf8'))).toStrictEqual(worklist);
	});

	test('resume re-reads the frozen measurement rather than measuring again', async () => {
		const cwd = setupMeasurable();
		const config = await readConfig({ cwd });
		const fresh = await initializeCoverageRun({ cwd, runId: 'run-1', driver, config, loadedConfig: { config } });

		const resumed = await initializeCoverageRun({
			cwd,
			runId: 'run-1',
			driver,
			config,
			loadedConfig: { config },
			existing: { ...fresh.manifest, pipeline: 'coverage' },
		});

		expect(resumed.worklist).toStrictEqual(fresh.worklist);
	});

	test.each([
		{ pipeline: undefined, named: 'implement', command: 'resume' },
		{ pipeline: PipelineKind.Implement, named: 'implement', command: 'resume' },
		{ pipeline: PipelineKind.Refactor, named: 'refactor', command: 'refactor' },
	])('a $named run is sent back to its own resume door', async ({ pipeline, named, command }) => {
		const cwd = setupMeasurable();
		const config = await readConfig({ cwd });

		const error = await getRejectionError({
			promise: initializeCoverageRun({ cwd, runId: 'run-1', driver, config, loadedConfig: { config }, existing: manifestWith({ pipeline, config }) }),
		});

		expect(error.message).toBe(`run run-1 belongs to the ${named} pipeline — resume it with: lightsout ${command} --run run-1`);
	});

	test('a resume standing in a linked worktree reads the frozen measurement from the run’s own folder', async () => {
		const { config, fresh, worktree } = await setupWorktreeResume();

		const resumed = await initializeCoverageRun({ cwd: worktree, runId: 'run-1', driver, config, loadedConfig: { config }, existing: fresh.manifest });

		expect(resumed.worklist).toStrictEqual(fresh.worklist);
		// the run's records live in the primary checkout, so the recorded path
		// joined onto this worktree names a file that was never written here
		expect(existsSync(join(worktree, fresh.manifest.plan))).toBe(false);
	});

	test("replaces a resumed coverage run's owner record and writes nothing for another pipeline's run", async () => {
		const { cwd, config, fresh, implementRun } = await setupOwnedResume();

		await initializeCoverageRun({ cwd, runId: 'run-1', driver, config, loadedConfig: { config }, existing: fresh.manifest });
		const error = await getRejectionError({
			promise: initializeCoverageRun({ cwd, runId: 'run-implement', driver, config, loadedConfig: { config }, existing: implementRun }),
		});

		const resumedOwner = await readRunOwner({ cwd, runId: 'run-1' });
		const implementOwner = await readRunOwner({ cwd, runId: 'run-implement' });

		// the resuming process now answers for the coverage run
		expect(resumedOwner).toEqual(expect.objectContaining({ pid: process.pid }));
		// the refusal happens before any write, so the implement run gains no owner
		expect(error.message).toMatch(/belongs to the implement pipeline/);
		expect(implementOwner).toBe(undefined);
	});

	test('a fresh coverage run records the loaded config and its path, and a resume keeps the recorded one', async () => {
		const { cwd, stamped, fresh, resumeLoadedConfig, recordedConfig, configPath } = await setupLoadedConfigResume();

		const resumed = await initializeCoverageRun({ cwd, runId: 'run-1', driver, config: stamped, loadedConfig: resumeLoadedConfig, existing: fresh.manifest });

		const onDisk = await readRunManifest({ cwd, runId: 'run-1' });

		// the fresh run recorded the config as read, never the stamped harness or model
		expect({
			recorded: { config: onDisk.config, configPath: onDisk.configPath },
			resumed: resumed.manifest,
		}).toStrictEqual({
			recorded: { config: recordedConfig, configPath },
			resumed: fresh.manifest,
		});
	});
});
