import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { resumeCommand } from '#src/cli/resumeCommand.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';
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

/** The seeded run's manifest as it stands on disk after the command ran. */
const readManifest = ({ cwd }: { cwd: string }): { willShip?: boolean } => JSON.parse(readFileSync(join(runDirFor({ cwd, runId }), 'manifest.json'), 'utf8'));

/** The sentence a held ticket's refusal carries — human-facing copy, and here it is the fixture the guard answers with. */
const heldSentence =
	"lo-88 · on hold: run run-abc could not get the machine for its gates, so it stopped without judging the code — remove the 'queue-blocked-gate-timed-out' label from the ticket to release it";

/** A seeded resume whose pre-source lifecycle guard answers exactly what the case asks for. */
const setupResumeGuard = ({ manifest, refusal }: { manifest: RunManifest; refusal?: string }) => {
	mockRequireImplementLifecycle.mockResolvedValue(refusal);

	return setupResume({ args: ['--run', runId], manifest });
};

/**
 * A seeded resume whose manifest records a workspace of its own — a second repo
 * standing in for the worktree the run was cut into, with the run folder its
 * records reach it through already there. `present: false` records a workspace
 * that has since been removed.
 *
 * The guard is answered `undefined` here, so the lifecycle write is never the
 * reason one of these cases stops.
 */
const setupResumeWorkspace = ({ present }: { present: boolean }) => {
	mockRequireImplementLifecycle.mockResolvedValue(undefined);

	const workspace = present ? setupConsumerRepo() : mkdtempSync(join(tmpdir(), 'lightsout-gone-'));

	if (present) {
		mkdirSync(runDirFor({ cwd: workspace, runId }), { recursive: true });
	} else {
		rmSync(workspace, { recursive: true, force: true });
	}

	return {
		workspace,
		...setupResume({ args: ['--run', runId], manifest: manifestOf({ pipeline: 'implement', willShip: true, workspace }) }),
	};
};

/** A config this engine accepts, standing for the one a run recorded when it started. */
const recordedConfig = { gates: { check: 'true', test: 'true', 'test-coverage': false }, 'standards-pack': false };

/** A seeded run's manifest exactly as its bytes stand on disk, so a refusal can be shown to have written nothing. */
const readManifestText = ({ cwd, id }: { cwd: string; id: string }): string => readFileSync(join(runDirFor({ cwd, runId: id }), 'manifest.json'), 'utf8');

/**
 * An implement run every remaining step of which is already recorded passed, so
 * the resume re-enters, spawns no harness and reaches a pass. --skip-refactor
 * drops the refactor trio; the changed file stands for work already in history.
 * The guard is answered `undefined`, and nothing asks for a ship, so the run's
 * own report is the last thing the command prints.
 */
const setupPassingResume = () => {
	mockRequireImplementLifecycle.mockResolvedValue(undefined);

	const seeded = setupResume({
		args: ['--run', runId, '--skip-refactor'],
		manifest: manifestOf({
			pipeline: 'implement',
			plan: 'plan.md',
			changedFiles: ['src/index.js'],
			steps: ['clean-slate', 'implement', 'format-implement', 'verify-implement', 'write-tests', 'format-tests', 'verify-tests'].map((id) => ({
				id,
				status: RunStatus.Passed,
				attempts: 1,
			})),
		}),
	});

	/** The run's saved final report as it stands on disk after the command ran. */
	const readFinalReport = (): { lines: string[]; exitCode: number; finishedAt: string } =>
		JSON.parse(readFileSync(join(runDirFor({ cwd: seeded.cwd, runId }), 'report.json'), 'utf8'));

	return { ...seeded, readFinalReport };
};

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
	test('without --run it prints the usage text on stderr and exits 1 before reading any run', async () => {
		const { context, logged, errors, exitCodes } = setupResume({ args: ['--skip-refactor'] });

		await expect(resumeCommand(context)).rejects.toThrow(/process\.exit/);

		expect(logged).toStrictEqual([]);
		expect(errors[0] ?? '').toMatch(/^lightsout — deterministic engine for coding agents/);
		expect(exitCodes).toStrictEqual([1]);
	});

	test('a --run naming no run on disk is the typed id being wrong, not a missing file', async () => {
		const { context, logged, errors, exitCodes } = setupResume({ args: ['--run', 'ghost'] });

		await expect(resumeCommand(context)).rejects.toThrow(/process\.exit/);

		expect(logged).toStrictEqual([]);
		expect(errors).toStrictEqual([`no run matching 'ghost' — list the runs this repo has with: lightsout status`]);
		expect(exitCodes).toStrictEqual([1]);
	});

	test('a manifest on disk that does not parse is a hard error, never softened into the message a mistyped id gets', async () => {
		const { context, logged, errors, exitCodes } = setupResume({ args: ['--run', runId], rawManifest: '{ "runId": ' });

		await expect(resumeCommand(context)).rejects.toThrow(SyntaxError);

		// the run exists — the file behind it is broken, which is a different
		// problem, so nothing claims the id was wrong and nothing exits as handled
		expect(logged).toStrictEqual([]);
		expect(errors).toStrictEqual([]);
		expect(exitCodes).toStrictEqual([]);
	});

	test('a refactor run is sent to its own resume door rather than continued here', async () => {
		const { context, errors, exitCodes } = setupResume({ args: ['--run', runId], manifest: manifestOf({ pipeline: 'refactor' }) });

		await expect(resumeCommand(context)).rejects.toThrow(/process\.exit/);

		expect(errors).toStrictEqual([`run ${runId} belongs to the refactor pipeline — resume it with: lightsout refactor --run ${runId}`]);
		expect(exitCodes).toStrictEqual([1]);
	});

	test('a coverage run is sent to its own resume door too, named exactly as it is typed', async () => {
		const { context, errors, exitCodes } = setupResume({ args: ['--run', runId], manifest: manifestOf({ pipeline: 'coverage' }) });

		await expect(resumeCommand(context)).rejects.toThrow(/process\.exit/);

		// a hint a reader retypes is a contract: the wrong command word sends them nowhere
		expect(errors).toStrictEqual([`run ${runId} belongs to the coverage pipeline — resume it with: lightsout test-coverage-to-threshold --run ${runId}`]);
		expect(exitCodes).toStrictEqual([1]);
	});

	test('a queue run is sent back to `lightsout queue` itself, with no --run flag the command does not take', async () => {
		const { context, errors, exitCodes } = setupResume({ args: ['--run', runId], manifest: manifestOf({ pipeline: 'queue' }) });

		await expect(resumeCommand(context)).rejects.toThrow(/process\.exit/);

		// re-running the queue IS its resume path, so a `--run <id>` here would be a flag the reader could not type
		expect(errors).toStrictEqual([`run ${runId} belongs to the queue pipeline — resume it with: lightsout queue (a restart resumes parked tickets first)`]);
		expect(exitCodes).toStrictEqual([1]);
	});

	test('an implement run is continued by the implement pipeline, its banner naming the state it stopped in', async () => {
		const { context, errors, logged, exitCodes } = setupResume({ args: ['--run', runId], manifest: manifestOf({ pipeline: 'implement' }) });

		await expect(resumeCommand(context)).rejects.toThrow(/process\.exit/);

		expect(logged[0]).toBe(`lightsout: resuming run ${runId} (was: failed, plan: ghost.md)`);
		// the single-plan pipeline ran: its own plan read is what stopped the run
		expect(errors.join('\n')).toMatch(/plan file not found: .*ghost\.md/);
		expect(exitCodes).toStrictEqual([1]);
	});

	test.each([
		{ label: 'a run stamped to ship', willShip: true },
		{ label: 'a run that was never going to', willShip: undefined },
	])('resume clears the ship stamp on $label when nothing asks for a ship', async ({ willShip }) => {
		const { context, cwd } = setupResume({ args: ['--run', runId], manifest: manifestOf({ pipeline: 'implement', willShip }) });

		await expect(resumeCommand(context)).rejects.toThrow(/process\.exit/);

		// no config and no flag, so nothing asks: a stamp left standing would draw
		// a ship row nothing will ever fill
		expect(readManifest({ cwd }).willShip).toBe(willShip === true ? false : undefined);
	});

	test.each([
		{ label: 'a run stamped to ship', willShip: true },
		{ label: 'a run that was never going to', willShip: undefined },
	])('resume stamps $label to ship when --ship is typed, so a fixed run reaches the merge', async ({ willShip }) => {
		const { context, cwd } = setupResume({ args: ['--run', runId, '--ship'], manifest: manifestOf({ pipeline: 'implement', willShip }) });

		await expect(resumeCommand(context)).rejects.toThrow(/process\.exit/);

		// resume ships on the same terms implement does, so the row the progress
		// view draws matches the ship that is actually coming
		expect(readManifest({ cwd }).willShip).toBe(true);
	});

	test('resume refuses --ship and --no-ship together, the way implement does', async () => {
		const { context, errors, exitCodes } = setupResume({
			args: ['--run', runId, '--ship', '--no-ship'],
			manifest: manifestOf({ pipeline: 'implement' }),
		});

		await expect(resumeCommand(context)).rejects.toThrow(/process\.exit/);

		expect(errors.join('\n')).toMatch(/--ship/u);
		expect(exitCodes).toStrictEqual([1]);
	});

	test('a manifest written before runs recorded their pipeline still resumes as an implement run', async () => {
		const { context, errors, logged, exitCodes } = setupResume({
			args: ['--run', runId],
			manifest: manifestOf({ pipeline: undefined, status: RunStatus.PausedRateLimit }),
		});

		await expect(resumeCommand(context)).rejects.toThrow(/process\.exit/);

		expect(logged[0]).toBe(`lightsout: resuming run ${runId} (was: paused-rate-limit, plan: ghost.md)`);
		expect(errors.join('\n')).toMatch(/plan file not found: .*ghost\.md/);
		expect(exitCodes).toStrictEqual([1]);
	});

	test('a resumed run that walks past every remaining step finishes it and exits 0', async () => {
		// --skip-refactor drops the refactor trio, leaving exactly these seven steps;
		// each already recorded passed, so the run re-enters, spawns no harness, and
		// reaches the end — the only way the success exit code is observable here.
		const { context, logged, exitCodes } = setupResume({
			args: ['--run', runId, '--skip-refactor'],
			manifest: manifestOf({
				pipeline: 'implement',
				plan: 'plan.md',
				// the run records work it already did: a clean tree with changed files
				// behind it is work already in history, where a clean tree with none is
				// the silent agent the commit step fails the run over
				changedFiles: ['src/index.js'],
				steps: ['clean-slate', 'implement', 'format-implement', 'verify-implement', 'write-tests', 'format-tests', 'verify-tests'].map((id) => ({
					id,
					status: RunStatus.Passed,
					attempts: 1,
				})),
			}),
		});

		await expect(resumeCommand(context)).rejects.toThrow(/process\.exit/);

		// the manifest is left saying the run passed, and the report says so too —
		// under the shortened id a reader retypes into the next command
		expect(logged).toContain('run       run-resu · PASSED');
		expect(logged).toContain('plan      plan.md');
		expect(exitCodes).toStrictEqual([0]);
	});

	test('a phased run is continued by the coordinator, which stops on the phase that ends short', async () => {
		const { context, errors, exitCodes } = setupResume({
			args: ['--run', runId],
			manifest: manifestOf({
				pipeline: 'phases',
				plan: join('plans', 'demo', 'overview.md'),
				steps: [{ id: 'phase1.md', status: RunStatus.Pending, attempts: 0 }],
			}),
		});

		await expect(resumeCommand(context)).rejects.toThrow(/process\.exit/);

		// the phase loop ran: only the coordinator reports a phase number and a resume id
		expect(errors.join('\n')).toMatch(/phase 1\/1 \(phase1\.md\) ended failed/);
		expect(errors.join('\n')).toContain(`resume with: lightsout resume --run ${runId}`);
		expect(exitCodes).toStrictEqual([1]);
	});

	test('a resumed phase colliding with a live run lock is reported in its own words, not as a crash', async () => {
		const { context, errors, exitCodes } = setupResume({
			args: ['--run', runId],
			locked: true,
			manifest: manifestOf({
				pipeline: 'phases',
				plan: join('plans', 'demo', 'overview.md'),
				steps: [{ id: 'phase1.md', status: RunStatus.Pending, attempts: 0 }],
			}),
		});

		await expect(resumeCommand(context)).rejects.toThrow(/process\.exit/);

		expect(errors.join('\n')).toContain('another lightsout run is active in this repo');
		expect(errors.join('\n')).not.toMatch(/ {4}at /);
		expect(exitCodes).toStrictEqual([1]);
	});

	test('standards turned off are announced on the resume banner as the repo root having none', async () => {
		const { context, logged } = setupResume({
			args: ['--run', runId],
			manifest: manifestOf({ pipeline: 'implement' }),
			config: { 'standards-pack': false },
		});

		await expect(resumeCommand(context)).rejects.toThrow(/process\.exit/);

		expect(logged).toContain('  repo root: none (standards-pack false)');
	});

	test('the harness the run started with wins over the config, and that config harness keeps its model to itself', async () => {
		const { context, logged } = setupResume({
			args: ['--run', runId],
			manifest: manifestOf({ harness: 'codex' }),
			config: { harness: 'claude-code', model: 'sonnet-x', effort: 'high' },
		});

		await expect(resumeCommand(context)).rejects.toThrow(/process\.exit/);

		// the model names a model of the harness that is NOT resuming, so it is dropped; effort is harness-neutral and stays
		expect(logged.some((line) => line.startsWith('  harness: codex · model: harness default · effort: high'))).toBeTruthy();
	});

	test('a config model for the same harness the run recorded rides into the resumed run', async () => {
		const { context, logged } = setupResume({
			args: ['--run', runId],
			manifest: manifestOf({ harness: 'claude-code' }),
			config: { model: 'sonnet-x' },
		});

		await expect(resumeCommand(context)).rejects.toThrow(/process\.exit/);

		expect(logged.some((line) => line.startsWith('  harness: claude-code · model: sonnet-x'))).toBeTruthy();
	});

	test('refuses to resume a held ticket without touching the manifest', async () => {
		const { context, cwd, logged, errors, exitCodes } = setupResumeGuard({
			manifest: manifestOf({ pipeline: 'implement', willShip: true }),
			refusal: heldSentence,
		});

		await expect(resumeCommand(context)).rejects.toThrow(/process\.exit/);

		expect(mockRequireImplementLifecycle).toHaveBeenCalledWith(
			expect.objectContaining({ cwd, config: expect.anything(), env: process.env, onProgress: expect.any(Function) }),
		);
		expect(errors).toStrictEqual([heldSentence]);
		expect(exitCodes).toStrictEqual([1]);
		// nothing printed and the seeded ship stamp still standing: the refusal
		// landed before the restamp and before any pipeline began
		expect(logged).toStrictEqual([]);
		expect(readManifest({ cwd }).willShip).toBe(true);
	});

	test('resumes an unheld run unchanged', async () => {
		const { context, cwd, logged, errors, exitCodes } = setupResumeGuard({ manifest: manifestOf({ pipeline: 'implement', willShip: true }) });

		await expect(resumeCommand(context)).rejects.toThrow(/process\.exit/);

		expect(logged[0]).toBe(`lightsout: resuming run ${runId} (was: failed, plan: ghost.md)`);
		expect(errors.join('\n')).toMatch(/plan file not found: .*ghost\.md/);
		expect(exitCodes).toStrictEqual([1]);
		// nothing asks for a ship, so the restamp the guard stands in front of still
		// cleared the stamp — the run behaves exactly as it does today
		expect(readManifest({ cwd }).willShip).toBe(false);
	});

	test('a resumed run works in the workspace it recorded and keeps its records where they are', async () => {
		const { context, cwd, workspace, logged, errors, exitCodes } = setupResumeWorkspace({ present: true });

		await expect(resumeCommand(context)).rejects.toThrow(/process\.exit/);

		expect(logged[0]).toBe(`lightsout: resuming run ${runId} (was: failed, plan: ghost.md)`);
		// the plan is looked for under the recorded workspace, never under the
		// checkout the command was launched from: the pipeline is building there
		expect(errors.join('\n')).toContain(`plan file not found: ${join(workspace, 'ghost.md')}`);
		expect(errors.join('\n')).not.toContain(join(cwd, 'ghost.md'));
		// the resumed run names the config path it recorded — the launching checkout's file — rather than the workspace's copy
		expect(logged).toContain(`  config: ${join(cwd, 'lightsout.config.json')}`);
		// and the ship restamp still landed in the launching checkout, which is
		// where this run's records live and stay
		expect(readManifest({ cwd }).willShip).toBe(false);
		expect(exitCodes).toStrictEqual([1]);
	});

	test('a resumed run whose workspace has gone stops before anything runs', async () => {
		const { context, cwd, workspace, logged, errors, exitCodes } = setupResumeWorkspace({ present: false });

		await expect(resumeCommand(context)).rejects.toThrow(/process\.exit/);

		expect(errors.join('\n')).toContain(workspace);
		expect(exitCodes).toStrictEqual([1]);
		// no banner, no lifecycle write, and the seeded ship stamp untouched: the
		// refusal landed before any of them, so nothing was rebuilt in the
		// launching checkout by accident
		expect(logged).toStrictEqual([]);
		expect(mockRequireImplementLifecycle).not.toHaveBeenCalled();
		expect(readManifest({ cwd }).willShip).toBe(true);
	});

	test('a passed implement run still has nothing to resume', async () => {
		const { context, errors, exitCodes } = setupResume({
			args: ['--run', runId],
			manifest: manifestOf({ pipeline: 'implement', status: RunStatus.Passed }),
		});

		await expect(resumeCommand(context)).rejects.toThrow(/process\.exit/);

		// only a direct run earns a continuation past `passed` — every other
		// pipeline has done all its work by then
		expect(errors).toStrictEqual([`run ${runId} already passed — nothing to resume`]);
		expect(exitCodes).toStrictEqual([1]);
	});

	test("a resumed run saves its final report in the run's folder", async () => {
		const { context, logged, exitCodes, readFinalReport } = setupPassingResume();

		await expect(resumeCommand(context)).rejects.toThrow(/process\.exit/);

		const report = readFinalReport();

		// the saved lines are the report card exactly as printed — nothing follows
		// it on a run that will not ship, so it is the tail of what was logged
		expect(report.lines).toContain('run       run-resu · PASSED');
		expect(logged.slice(-report.lines.length)).toStrictEqual(report.lines);
		expect(report.exitCode).toBe(0);
		expect(exitCodes).toStrictEqual([0]);
	});

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
