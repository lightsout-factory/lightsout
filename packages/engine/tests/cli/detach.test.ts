import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, expect, test } from '@jest/globals';
import { isPidAlive } from '#src/runState/isPidAlive.ts';
import { fakeHarnessOnPath } from '#tests/helpers/fakeHarnessOnPath.ts';
import { runCli } from '#tests/helpers/runCli.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';

// A real detached launch: the parent the test spawns re-spawns the engine in its
// own session, so these cases watch two processes — the parent, which must come
// back, and the engine it left behind.
const realPath = process.env.PATH ?? '';

afterAll(() => {
	process.env.PATH = realPath;
});

// Anchored the way runCli anchors it. runCli hides the pid of the process it
// spawns, and the started case has to tell the parent apart from the engine.
const cliPath = join(__dirname, '..', '..', '..', '..', '.test-dist', 'cli-under-test.mjs');

/** The line a detached launch prints at once, naming the run and where its engine's output goes. */
const startingRunLine = /^starting run (\S+) — engine output: (.+)$/m;

/**
 * Run the built CLI as the parent of a detached launch, resolved once it has
 * exited and its stdout and stderr have both reached EOF.
 *
 * @param args - argv after the program name
 */
const launchCli = ({ args }: { args: string[] }): Promise<{ stdout: string; stderr: string; code: number | null; parentPid: number | undefined }> =>
	new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [cliPath, ...args], { env: { ...process.env } });

		let stdout = '';
		let stderr = '';

		child.stdout.on('data', (chunk) => {
			stdout += chunk;
		});
		child.stderr.on('data', (chunk) => {
			stderr += chunk;
		});
		child.on('error', reject);
		child.on('close', (code) => resolve({ stdout, stderr, code, parentPid: child.pid }));
	});

const readJsonOrUndefined = async <T>({ path }: { path: string }): Promise<T | undefined> =>
	readFile(path, 'utf8').then(
		(text) => JSON.parse(text) as T,
		() => undefined,
	);

// A plan address whose plan folder does not exist, in a repo naming no ticket
// tracker: the child refuses it before any run is created, so the refusal is
// what the parent has to relay.
const setupMissingPlan = () => {
	const cwd = setupConsumerRepo();
	const planPath = join('.lightsout', 'work-orders', 'lo-999-ghost-plan', 'plans', '001-ghost-plan', 'plan.md');

	return { cwd, planPath };
};

test("implement --detach relays a child's refusal and exit code instead of reporting a started run", async () => {
	const { cwd, planPath } = setupMissingPlan();

	const { stdout, stderr, code } = await launchCli({ args: ['implement', '--detach', '--plan', planPath, '--cwd', cwd] });
	const runId = startingRunLine.exec(stdout)?.[1] ?? 'no-run-id-printed';
	const launchLog = await readFile(join(cwd, '.lightsout', 'launches', `${runId}.log`), 'utf8').catch(() => '');

	expect({ code, stdoutLines: stdout.trimEnd().split('\n').length, namesStartingRun: startingRunLine.test(stdout) }).toStrictEqual({
		code: 1,
		stdoutLines: 1,
		namesStartingRun: true,
	});
	expect(stderr).toMatch(/no plan at .*001-ghost-plan/);
	expect(launchLog).toMatch(/no plan at .*001-ghost-plan/);
}, 120_000);

// A committed consumer repo with its one-line plan, and a `claude` on PATH that
// hangs, so the detached engine is still building when the parent has gone.
const setupHangingHarness = async () => {
	const cwd = setupConsumerRepo();

	await fakeHarnessOnPath({ binary: 'claude', systemPromptFlag: '--append-system-prompt-file', delaySeconds: 120 });

	return { cwd };
};

test('implement --detach returns once a real detached engine has started and leaves it running', async () => {
	const { cwd } = await setupHangingHarness();

	const { stdout, code, parentPid } = await launchCli({ args: ['implement', '--detach', '--no-worktree', '--plan', 'plan.md', '--cwd', cwd] });
	const runId = startingRunLine.exec(stdout)?.[1] ?? 'no-run-id-printed';
	const runDir = runDirFor({ cwd, runId });
	const owner = await readJsonOrUndefined<{ pid: number }>({ path: join(runDir, 'owner.json') });
	const manifest = await readJsonOrUndefined<{ status: string }>({ path: join(runDir, 'manifest.json') });
	const ownerPid = owner?.pid;
	// Never probed without a pid: signal 0 sent to a non-positive pid asks about a whole process group.
	const engineAlive = ownerPid !== undefined && isPidAlive({ pid: ownerPid });
	// Stopped before any assertion, so a failed one never leaves the engine running.
	const stopped = await runCli({ args: ['stop', '--run', runId, '--cwd', cwd] });

	expect({ code, namesStartingRun: startingRunLine.test(stdout), namesRunAgain: stdout.split(runId).length > 2 }).toStrictEqual({
		code: 0,
		namesStartingRun: true,
		namesRunAgain: true,
	});
	// The handshake promises the run exists, not that it has left `pending`; either status means it is going.
	const going = manifest?.status === 'pending' || manifest?.status === 'running';
	expect({ engineAlive, ownerIsParent: ownerPid === parentPid, going }).toStrictEqual({
		engineAlive: true,
		ownerIsParent: false,
		going: true,
	});
	expect(stopped.code).toBe(0);
}, 120_000);
