import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, test } from '@jest/globals';
import { parseFlags } from '#src/cli/common/parseFlags.ts';
import { stopCommand } from '#src/cli/stopCommand/stopCommand.ts';
import type { CommandContext } from '#src/common/types/CommandContext.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { captureCommandOutput } from '#tests/helpers/captureCommandOutput.ts';
import { hasChildExited } from '#tests/helpers/hasChildExited.ts';
import { seedRunDir } from '#tests/helpers/seedRunDir.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';
import { setupLockedStopRun } from '#tests/helpers/setupLockedStopRun.ts';
import { setupOwnedStopRoot } from '#tests/helpers/setupOwnedStopRoot.ts';
import { setupPhasedStopRoot } from '#tests/helpers/setupPhasedStopRoot.ts';
import { setupPreOwnerQueueWorker } from '#tests/helpers/setupPreOwnerQueueWorker.ts';
import { spyOnProcessKill } from '#tests/helpers/spyOnProcessKill.ts';
import { stopCommandFixture } from '#tests/helpers/stopCommandFixture.ts';
import { usageFixture } from '#tests/helpers/usageFixture.ts';

// Real run state on disk and real processes: the engine behind each run is a
// spawned Node child, so "stopped" and "left alone" are read off the child
// itself. Only the cases about how the system answers a signal spy on
// `process.kill`, as isPidAlive.unit.test.ts does.

const { rootId, phaseChildId, queueRunId } = stopCommandFixture;

// Platform is a non-writable property, which jest.replaceProperty cannot pin
// (see voiceOnCommand.unit.test.ts), so one hook puts the real one back.
const realPlatform = process.platform;

const pinPlatform = ({ platform }: { platform: string }) => {
	Object.defineProperty(process, 'platform', { value: platform, writable: false, enumerable: true, configurable: true });
};

afterEach(() => {
	pinPlatform({ platform: realPlatform });
});

const contextFor = ({ cwd, args }: { cwd: string; args: string[] }): CommandContext => ({ flags: parseFlags({ args }), rest: [], cwd });

/** A repo with no runs, and the command invoked with the given arguments. */
const setupBareRepo = ({ args }: { args: string[] }) => {
	const captured = captureCommandOutput();
	const cwd = setupConsumerRepo({ git: false });
	const kill = spyOnProcessKill({ signals: 'real' });

	return { context: contextFor({ cwd, args }), kill, ...captured };
};

/** A phase child whose coordinator's manifest is missing, so the family root cannot be read. */
const setupOrphanedPhaseChild = async () => {
	const captured = captureCommandOutput();
	const cwd = setupConsumerRepo({ git: false });
	const kill = spyOnProcessKill({ signals: 'real' });

	await seedRunDir({ cwd, manifest: { runId: phaseChildId, parentRunId: rootId, status: RunStatus.Running, currentStep: 'implement' } });

	return { context: contextFor({ cwd, args: ['--run', phaseChildId] }), kill, ...captured };
};

describe('stopCommand', () => {
	test('stopCommand: prints the usage and exits 1 when --run is missing', async () => {
		const { context, errors, exitCodes, kill } = setupBareRepo({ args: [] });

		const stopped = stopCommand(context);

		await expect(stopped).rejects.toThrow(/process\.exit/);
		expect({ errors, exitCodes, signals: kill.mock.calls }).toStrictEqual({ errors: [usageFixture], exitCodes: [1], signals: [] });
	});

	test('stopCommand: names an unknown run id on stderr and exits 1', async () => {
		const { context, errors, exitCodes } = setupBareRepo({ args: ['--run', 'run-gone'] });

		const stopped = stopCommand(context);

		await expect(stopped).rejects.toThrow(/process\.exit/);
		expect(exitCodes).toStrictEqual([1]);
		expect(errors.join('\n')).toContain('run-gone');
		// a one-line message, not a stack trace
		expect(errors.join('\n')).not.toMatch(/\n\s+at /);
	});

	test('stopCommand: refuses a queue worker run and names the queue run to stop instead', async () => {
		const { context, errors, exitCodes, kill } = await setupOwnedStopRoot({ owner: 'pointer' });

		const stopped = stopCommand(context);

		await expect(stopped).rejects.toThrow(/process\.exit/);
		expect(exitCodes).toStrictEqual([1]);
		expect(errors.join('\n')).toContain(`lightsout stop --run ${queueRunId}`);
		expect(kill.mock.calls.filter(([, signal]) => signal !== 0)).toStrictEqual([]);
	});

	test('stopCommand: exits 0 saying nothing is running when the owner process is gone', async () => {
		const { context, logged, exitCodes, manifestPath, manifestBefore } = await setupOwnedStopRoot({ owner: 'dead' });

		const stopped = stopCommand(context);

		await expect(stopped).rejects.toThrow(/process\.exit/);
		expect(exitCodes).toStrictEqual([0]);
		expect(logged.join('\n')).toContain(rootId);
		expect(logged.join('\n')).toMatch(/no live process|not running|nothing (is )?running/i);
		expect(readFileSync(manifestPath, 'utf8')).toBe(manifestBefore);
	});

	test('stopCommand: leaves a pid alone and exits 1 when its start time no longer matches the owner record', async () => {
		const { context, errors, exitCodes, child, pid } = await setupOwnedStopRoot({ owner: 'mismatched' });

		const stopped = stopCommand(context);

		await expect(stopped).rejects.toThrow(/process\.exit/);
		expect(exitCodes).toStrictEqual([1]);
		expect(errors.join('\n')).toContain(String(pid));
		expect(await hasChildExited({ child, withinMs: 300 })).toBe(false);
	});

	test('stopCommand: stops the owner process and names the resume command without touching the manifest', async () => {
		const { context, logged, exitCodes, child, manifestPath, manifestBefore } = await setupOwnedStopRoot();

		const stopped = stopCommand(context);

		await expect(stopped).rejects.toThrow(/process\.exit/);
		expect(exitCodes).toStrictEqual([0]);
		expect(await hasChildExited({ child })).toBe(true);
		expect(logged.join('\n')).toContain(`lightsout resume --run ${rootId}`);
		// the run stays exactly as a crash would leave it, so it stays resumable
		expect(readFileSync(manifestPath, 'utf8')).toBe(manifestBefore);
	});

	test("stopCommand: climbs from a phase child to its coordinator's owner", async () => {
		const { context, logged, exitCodes, child } = await setupPhasedStopRoot({ childManifest: true, run: phaseChildId });

		const stopped = stopCommand(context);

		await expect(stopped).rejects.toThrow(/process\.exit/);
		expect(exitCodes).toStrictEqual([0]);
		expect(await hasChildExited({ child })).toBe(true);
		expect(logged.join('\n')).toContain(`lightsout resume --run ${rootId}`);
		expect(logged.join('\n')).not.toContain(`--run ${phaseChildId}`);
	});

	test('stopCommand: accepts the short run id a report printed', async () => {
		const { cwd, exitCodes, child } = await setupOwnedStopRoot();

		const stopped = stopCommand(contextFor({ cwd, args: ['--run', rootId.slice(0, 8)] }));

		await expect(stopped).rejects.toThrow(/process\.exit/);
		expect(exitCodes).toStrictEqual([0]);
		expect(await hasChildExited({ child })).toBe(true);
	});

	test('stopCommand: names the queue restart as the resume door for a stopped queue', async () => {
		const { context, logged, exitCodes, child } = await setupOwnedStopRoot({ pipeline: PipelineKind.Queue });

		const stopped = stopCommand(context);

		await expect(stopped).rejects.toThrow(/process\.exit/);
		expect(exitCodes).toStrictEqual([0]);
		expect(await hasChildExited({ child })).toBe(true);
		expect(logged.join('\n')).toContain('lightsout queue');
		expect(logged.join('\n')).not.toContain('lightsout resume --run');
	});

	test('stopCommand: warns about remaining agent groups, prints no resume command and exits 1 when the engine had to be killed', async () => {
		const { context, logged, errors, exitCodes, child } = await setupOwnedStopRoot({ ignoresSigterm: true });

		const stopped = stopCommand(context);

		await expect(stopped).rejects.toThrow(/process\.exit/);
		expect(exitCodes).toStrictEqual([1]);
		expect(await hasChildExited({ child })).toBe(true);
		expect([...logged, ...errors].join('\n')).not.toMatch(/lightsout resume|resume --run/);
		expect(errors.join('\n')).toMatch(/agent/i);
		expect(errors.join('\n')).toMatch(/process group/i);
		expect(errors.join('\n')).toMatch(/worktree/i);
	}, 30_000);

	test('stopCommand: refuses on Windows with one line naming the POSIX requirement', async () => {
		const { context, errors, exitCodes, kill, child } = await setupOwnedStopRoot();
		pinPlatform({ platform: 'win32' });

		const stopped = stopCommand(context);

		await expect(stopped).rejects.toThrow(/process\.exit/);
		expect(exitCodes).toStrictEqual([1]);
		expect(kill.mock.calls).toStrictEqual([]);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toMatch(/POSIX/);
		expect(errors[0]).toMatch(/macOS/);
		expect(errors[0]).toMatch(/Linux/);
		expect(await hasChildExited({ child, withinMs: 300 })).toBe(false);
	});

	test('stopCommand: treats a named phase child with no manifest yet as not yet started', async () => {
		const { context, logged, exitCodes, child } = await setupPhasedStopRoot({ childManifest: false, run: rootId });

		const stopped = stopCommand(context);

		await expect(stopped).rejects.toThrow(/process\.exit/);
		expect(exitCodes).toStrictEqual([0]);
		expect(await hasChildExited({ child })).toBe(true);
		expect(logged.join('\n')).toContain(`lightsout resume --run ${rootId}`);
	});

	test("stopCommand: refuses a pre-owner queue worker whose lock holder is the queue's own process", async () => {
		const { context, errors, exitCodes, child } = await setupPreOwnerQueueWorker();

		const stopped = stopCommand(context);

		await expect(stopped).rejects.toThrow(/process\.exit/);
		expect(exitCodes).toStrictEqual([1]);
		expect(errors.join('\n')).toContain(`lightsout stop --run ${queueRunId}`);
		// signalling the worker's lock holder would kill the whole queue
		expect(await hasChildExited({ child, withinMs: 300 })).toBe(false);
	});

	test('stopCommand: leaves an unconfirmable pid alone when the run is no longer going', async () => {
		const { context, logged, exitCodes, child } = await setupOwnedStopRoot({ owner: 'unconfirmable', status: RunStatus.Passed });

		const stopped = stopCommand(context);

		await expect(stopped).rejects.toThrow(/process\.exit/);
		expect(exitCodes).toStrictEqual([0]);
		expect(logged.join('\n')).toMatch(/no live process|not running|nothing (is )?running/i);
		expect(await hasChildExited({ child, withinMs: 300 })).toBe(false);
	});

	test('stopCommand: stops an unconfirmable pid while the run is still going', async () => {
		const { context, exitCodes, child } = await setupOwnedStopRoot({ owner: 'unconfirmable' });

		const stopped = stopCommand(context);

		await expect(stopped).rejects.toThrow(/process\.exit/);
		expect(exitCodes).toStrictEqual([0]);
		expect(await hasChildExited({ child })).toBe(true);
	});

	test('stopCommand: exits 1 naming the pid when the system refuses the signal', async () => {
		const { context, errors, exitCodes, pid } = await setupOwnedStopRoot({ signals: 'refused' });

		const stopped = stopCommand(context);

		await expect(stopped).rejects.toThrow(/process\.exit/);
		expect(exitCodes).toStrictEqual([1]);
		expect(errors.join('\n')).toContain(String(pid));
	});

	test('stopCommand: exits 1 naming the pid when the engine survives SIGKILL', async () => {
		const { context, errors, exitCodes, pid } = await setupOwnedStopRoot({ signals: 'unanswered' });

		const stopped = stopCommand(context);

		await expect(stopped).rejects.toThrow(/process\.exit/);
		expect(exitCodes).toStrictEqual([1]);
		expect(errors.join('\n')).toContain(String(pid));
	}, 30_000);

	test('stopCommand: stops a run with no owner record through the run lock that names it', async () => {
		const { context, exitCodes, child } = await setupLockedStopRun({ holder: 'root' });

		const stopped = stopCommand(context);

		await expect(stopped).rejects.toThrow(/process\.exit/);
		expect(exitCodes).toStrictEqual([0]);
		expect(await hasChildExited({ child })).toBe(true);
	});

	test('stopCommand: stops a pre-owner phased run through the lock its moving phase holds', async () => {
		const { context, exitCodes, child } = await setupLockedStopRun({ holder: 'phase child' });

		const stopped = stopCommand(context);

		await expect(stopped).rejects.toThrow(/process\.exit/);
		expect(exitCodes).toStrictEqual([0]);
		expect(await hasChildExited({ child })).toBe(true);
	});

	test("stopCommand: leaves another run's lock holder alone when the run has no owner record", async () => {
		const { context, logged, exitCodes, child } = await setupLockedStopRun({ holder: 'unrelated run' });

		const stopped = stopCommand(context);

		await expect(stopped).rejects.toThrow(/process\.exit/);
		expect(exitCodes).toStrictEqual([0]);
		expect(logged.join('\n')).toMatch(/no live process|not running|nothing (is )?running/i);
		expect(await hasChildExited({ child, withinMs: 300 })).toBe(false);
	});

	test('stopCommand: reports a family root it cannot read on stderr and exits 1', async () => {
		const { context, errors, exitCodes, kill } = await setupOrphanedPhaseChild();

		const stopped = stopCommand(context);

		await expect(stopped).rejects.toThrow(/process\.exit/);
		expect(exitCodes).toStrictEqual([1]);
		expect(errors.join('\n')).toContain(rootId);
		expect(kill.mock.calls).toStrictEqual([]);
	});

	test.each([
		{ label: 'pending', status: RunStatus.Pending, willShip: false },
		{ label: 'passed but still awaiting its ship', status: RunStatus.Passed, willShip: true },
	])('stopCommand: stops an unconfirmable pid while the run is $label', async ({ status, willShip }) => {
		const { context, exitCodes, child } = await setupOwnedStopRoot({ owner: 'unconfirmable', status, willShip });

		const stopped = stopCommand(context);

		await expect(stopped).rejects.toThrow(/process\.exit/);
		expect(exitCodes).toStrictEqual([0]);
		expect(await hasChildExited({ child })).toBe(true);
	});

	test('stopCommand: reports a signal error it cannot read on stderr and exits 1', async () => {
		const { context, errors, exitCodes } = await setupOwnedStopRoot({ signals: 'failing' });

		const stopped = stopCommand(context);

		await expect(stopped).rejects.toThrow(/process\.exit/);
		expect(exitCodes).toStrictEqual([1]);
		expect(errors.join('\n')).toContain('EINVAL');
	});

	test.each([
		{ label: 'no run lock', holder: 'nobody' as const, status: RunStatus.Running },
		{ label: 'a lock whose holder is gone', holder: 'dead holder' as const, status: RunStatus.Running },
		{ label: 'a lock naming it on a run no longer going', holder: 'root' as const, status: RunStatus.Passed },
	])('stopCommand: says nothing is running for a run with no owner record and $label', async ({ holder, status }) => {
		const { context, logged, exitCodes, child } = await setupLockedStopRun({ holder, status });

		const stopped = stopCommand(context);

		await expect(stopped).rejects.toThrow(/process\.exit/);
		expect(exitCodes).toStrictEqual([0]);
		expect(logged.join('\n')).toMatch(/no live process|not running|nothing (is )?running/i);
		expect(await hasChildExited({ child, withinMs: 300 })).toBe(false);
	});
});
