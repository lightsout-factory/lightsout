import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@jest/globals';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { RunNotFoundError } from '#src/runState/RunNotFoundError.ts';
import { getRunView } from '#src/views/getRunView/getRunView.ts';
import { freshCwd } from '#tests/helpers/freshCwd.ts';
import { getRejectionError } from '#tests/helpers/getRejectionError.ts';
import { seedRunDir } from '#tests/helpers/seedRunDir.ts';

const usage = { inputTokens: 10, outputTokens: 100, cacheReadTokens: 880, cacheCreationTokens: 110, costUsd: 0.5 };

const agentLine = ({ step, at = '2026-01-01T00:00:00.000Z' }: { step: string; at?: string }) =>
	`${JSON.stringify({ at, step, model: 'opus', effort: 'high', ...usage })}\n`;

const commandLine = ({ kind, step, ...rest }: { kind: string; step?: string; rerun?: boolean; skipped?: true }) =>
	`${JSON.stringify({ at: '2026-01-01T00:00:00.000Z', kind, group: 'root', command: 'pnpm check', exitCode: 0, durationMs: 1200, step, ...rest })}\n`;

test('a run with no evidence files at all still assembles, with empty logs rather than a failure', async () => {
	const cwd = await freshCwd();

	await seedRunDir({ cwd, manifest: { runId: 'run-bare' } });

	const view = await getRunView({ cwd, runId: 'run-bare' });

	expect(view.gates).toStrictEqual([]);
	expect(view.agents).toStrictEqual([]);
	expect(view.friction).toStrictEqual([]);
	expect(view.gateTotals).toStrictEqual({ commands: 0, reruns: 0, skipped: 0 });
	// the listing row is the same one the sidebar shows, assembled by the same helper
	expect(view.listing.title).toBe('demo');
	expect(view.harness).toBe('claude-code');
});

test('gate and agent lines are validated at the boundary, and a malformed line is skipped', async () => {
	const cwd = await freshCwd();

	await seedRunDir({
		cwd,
		manifest: { runId: 'run-logs', steps: [{ id: 'implement', status: RunStatus.Passed, attempts: 1, durationMs: 900 }] },
		logs: {
			agents: `${agentLine({ step: 'implement' })}{ not json\n${JSON.stringify({ at: 'x', step: 'implement' })}\n${agentLine({ step: 'implement-supervisor' })}`,
			commands: `${commandLine({ kind: 'check', step: 'implement' })}${commandLine({ kind: 'test', step: 'implement', rerun: true })}${commandLine({ kind: 'build', skipped: true })}{ not json\n`,
		},
	});

	const view = await getRunView({ cwd, runId: 'run-logs' });

	// two well-formed invocations survive; the unparseable line and the one
	// missing its usage fields are skipped, never guessed at
	expect(view.agents.map((entry) => entry.step)).toStrictEqual(['implement', 'implement-supervisor']);
	expect(view.agents[0]?.effort).toBe('high');
	expect(view.gates.map((gate) => gate.kind)).toStrictEqual(['check', 'test', 'build']);
	// a record written outside a step carries no step
	expect(view.gates[2]?.step).toBe(undefined);
	expect(view.gateTotals).toStrictEqual({ commands: 2, reruns: 1, skipped: 1 });
	// a supervisor consultation is spend on the step it supervised
	expect(view.steps[0]).toStrictEqual({
		id: 'implement',
		status: RunStatus.Passed,
		attempts: 1,
		durationMs: 900,
		changedFiles: [],
		error: undefined,
		invocations: 2,
		outputTokens: 200,
		costUsd: 1,
		report: undefined,
		// the phase links belong to a coordinator's steps, and this is not one
		planPath: undefined,
		childRunId: undefined,
	});
	expect(view.gateMs).toBe(3600);
});

test('a step no agent invocation was attributed to reports zero spend rather than nothing', async () => {
	const cwd = await freshCwd();

	await seedRunDir({
		cwd,
		manifest: { runId: 'run-quiet', steps: [{ id: 'format', status: RunStatus.Passed, attempts: 1 }] },
		logs: { agents: agentLine({ step: 'implement' }) },
	});

	const view = await getRunView({ cwd, runId: 'run-quiet' });

	// a gate-only step costs nothing, which is a number rather than an absence
	expect(view.steps[0]).toMatchObject({ id: 'format', invocations: 0, outputTokens: 0, costUsd: 0 });
});

test("a step's own record reaches the view whole: the files it touched, the error it failed with, and its report", async () => {
	const cwd = await freshCwd();

	await seedRunDir({
		cwd,
		manifest: {
			runId: 'run-failed-step',
			status: RunStatus.Failed,
			steps: [
				{
					id: 'write-tests',
					status: RunStatus.Failed,
					attempts: 2,
					durationMs: 450,
					changedFiles: ['src/a.unit.test.ts', 'src/b.unit.test.ts'],
					error: 'coverage threshold not met',
					report: { status: 'failed', failures: ['threshold'] },
				},
			],
		},
	});

	const view = await getRunView({ cwd, runId: 'run-failed-step' });

	// the report stays opaque here — the manifest's own bytes, not a reshaped copy
	expect(view.steps[0]).toStrictEqual({
		id: 'write-tests',
		status: RunStatus.Failed,
		attempts: 2,
		durationMs: 450,
		changedFiles: ['src/a.unit.test.ts', 'src/b.unit.test.ts'],
		error: 'coverage threshold not met',
		invocations: 0,
		outputTokens: 0,
		costUsd: 0,
		report: { status: 'failed', failures: ['threshold'] },
		planPath: undefined,
		childRunId: undefined,
	});
});

test('friction is narrowed to this run — the log is repo-wide', async () => {
	const cwd = await freshCwd();

	await seedRunDir({ cwd, manifest: { runId: 'run-mine' } });
	await seedRunDir({ cwd, manifest: { runId: 'run-theirs' } });
	await writeFile(
		join(cwd, '.lightsout', 'friction.jsonl'),
		`${JSON.stringify({ at: '2026-01-01T00:00:00.000Z', runId: 'run-mine', step: 'implement', kind: 'friction', area: 'plan', detail: 'ambiguous' })}\n${JSON.stringify({ at: '2026-01-01T00:00:00.000Z', runId: 'run-theirs', step: 'implement', kind: 'decision', area: 'prompt', detail: 'guessed' })}\n`,
		'utf8',
	);

	const view = await getRunView({ cwd, runId: 'run-mine' });

	// the whole records, not counts — a detail page shows each entry's text
	expect(view.friction).toStrictEqual([
		{ at: '2026-01-01T00:00:00.000Z', runId: 'run-mine', step: 'implement', kind: 'friction', area: 'plan', detail: 'ambiguous' },
	]);
});

test('the eight-character id a report printed resolves to the run it names', async () => {
	const cwd = await freshCwd();

	await seedRunDir({ cwd, manifest: { runId: 'abcdef0123456789' } });

	expect((await getRunView({ cwd, runId: 'abcdef01' })).listing.runId).toBe('abcdef0123456789');
});

test('an id no run answers to rejects as a mistaken id, not a missing file', async () => {
	const cwd = await freshCwd();

	await seedRunDir({ cwd, manifest: { runId: 'run-real' } });

	const error = await getRejectionError({ promise: getRunView({ cwd, runId: 'run-imaginary' }) });

	expect(error).toBeInstanceOf(RunNotFoundError);
});

test('a run reports the files it changed and the ones nothing public reached', async () => {
	const cwd = await freshCwd();

	await seedRunDir({
		cwd,
		manifest: {
			runId: 'run-files',
			changedFiles: ['src/a.ts', 'src/b.ts'],
			unreachableChangedFiles: ['src/b.ts'],
			usage: { ...usage, invocations: 3 },
		},
	});

	const view = await getRunView({ cwd, runId: 'run-files' });

	expect(view.changedFiles).toStrictEqual(['src/a.ts', 'src/b.ts']);
	expect(view.unreachableChangedFiles).toStrictEqual(['src/b.ts']);
	expect(view.usage?.invocations).toBe(3);
	// the share of input the model read from cache, out of everything readable
	expect(view.cacheReadShare).toBe(880 / 1000);
	expect(view.listing.costUsd).toBe(0.5);
});
