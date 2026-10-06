import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { expect, test } from '@jest/globals';
import { messageOf } from '#src/common/messageOf.ts';
import type { WorkReport } from '#src/contracts/work/WorkReport.ts';
import { WorkReportStatus } from '#src/contracts/work/WorkReportStatus.ts';
import type { PipelineRun } from '#src/pipeline/common/PipelineRun.ts';
import { testWriterConcurrency } from '#src/pipeline/steps/common/constants/testWriterConcurrency.ts';
import type { TestTargetGroup } from '#src/pipeline/steps/common/types/TestTargetGroup.ts';
import { runWriterBatches } from '#src/pipeline/steps/writeTestsStep/runWriterBatches/runWriterBatches.ts';

// How the fan-out schedules: which groups may run beside each other, how a
// freed slot refills, what every writer is briefed with, and how the reports
// come back. The warm-up writer's own gate is a concern of its own, in one suite
// beside this one; rate limits and writer failures are in another.

// The fan-out's scenarios are split by concern, and each suite arranges its own
// writers. The stub below is restated per suite deliberately: a fixture reached
// across module lines would have to import this module's internals from outside
// it, and the barrel is not the place to publish a type only a test names.

/** A complete WorkReport with per-test overrides. */
const workReport = (overrides: Partial<WorkReport> = {}): WorkReport => ({
	status: WorkReportStatus.Complete,
	changedFiles: [],
	summary: 'stub',
	failures: [],
	...overrides,
});

/** What a stubbed writer invocation returns — the invokeRole outcome runWriterBatches reads. */
type Outcome = { ok: true; report: WorkReport } | { ok: false; failure: string; rateLimited: boolean };

/** A writer that answered with a report. */
const answered = (report: WorkReport): Outcome => ({ ok: true, report });

/**
 * A PipelineRun stub that records an ordered event log: `start:<file>` when a
 * writer spawns, `event:<file>` when it streams its first event, `end:<file>`
 * when it resolves. `respond` decides each writer's behavior by target file.
 */
const setupWriterRun = ({ respond }: { respond: (params: { file: string; onFirstEvent?: () => void; log: string[] }) => Promise<Outcome> }) => {
	const log: string[] = [];
	const prompts: string[] = [];

	const run = {
		cwd: mkdtempSync(join(tmpdir(), 'lightsout-writers-')),
		current: () => ({ runId: 'run-1' }),
		progress: () => undefined,
		invokeRole: async ({ invocation, onFirstEvent }: { invocation: { prompt: string }; onFirstEvent?: () => void }) => {
			const file = /- (\S+)/.exec(invocation.prompt)?.[1] ?? 'unknown';

			prompts.push(invocation.prompt);
			log.push(`start:${file}`);

			const outcome = await respond({ file, onFirstEvent, log });

			log.push(`end:${file}`);

			return outcome;
		},
	};

	return { run: run as unknown as PipelineRun, log, prompts };
};

/** One group per file, so every one competes for a slot. */
const groupsOf = (count: number): TestTargetGroup[] =>
	Array.from({ length: count }, (_, index) => ({
		files: [`src/file${index}.ts`],
	}));

test('runWriterBatches: a freed slot takes the next group while a slow writer is still running', async () => {
	// One writer far slower than the rest. Under batching, nothing past the
	// first `testWriterConcurrency` groups could start until it returned; the
	// slots are meant to refill from the fast ones instead.
	const slow = 'src/file1.ts';
	const { run, log } = setupWriterRun({
		respond: async ({ file, onFirstEvent }) => {
			if (onFirstEvent) {
				onFirstEvent();
			}

			await delay(file === slow ? 200 : 5);

			return answered(workReport());
		},
	});

	const queued = 2;
	const overflow = `src/file${testWriterConcurrency + queued}.ts`;
	const { reports } = await runWriterBatches({ run, groups: groupsOf(testWriterConcurrency + queued + 1), planContent: '# Plan' });

	expect(reports.length).toBe(testWriterConcurrency + queued + 1);
	// the queued group ran on a slot freed by a fast writer, not after the slow one
	expect(log.indexOf(`start:${overflow}`)).toBeLessThan(log.indexOf(`end:${slow}`));
});

test('runWriterBatches: complete, failed, and absent reports aggregate exactly as the step expects', async () => {
	const { run } = setupWriterRun({
		respond: async ({ file }) => {
			if (file === 'src/file1.ts') {
				return answered(workReport({ status: WorkReportStatus.Failed, failures: ['bad assertion'] }));
			}

			if (file === 'src/file2.ts') {
				return { ok: false, failure: 'driver exploded', rateLimited: false };
			}

			if (file === 'src/file3.ts') {
				return answered(workReport({ status: WorkReportStatus.TerminatedAmbiguity, failures: ['unclear plan'] }));
			}

			return answered(workReport());
		},
	});

	const { reports, failures, terminated, parked } = await runWriterBatches({ run, groups: groupsOf(4), planContent: '# Plan' });

	expect(parked).toBe(false);
	// an absent report contributes no report
	expect(reports.length).toBe(3);
	expect(failures.includes('src/file1.ts: failed — bad assertion')).toBeTruthy();
	expect(failures.includes('src/file2.ts: driver exploded')).toBeTruthy();
	expect(failures.includes('src/file3.ts: terminated:ambiguity — unclear plan')).toBeTruthy();
	// a termination status escalates, a plain failure does not
	expect(terminated).toBe(true);
});

test("runWriterBatches: the run's acceptance tests reach every writer in the fan-out", async () => {
	const { run, prompts } = setupWriterRun({ respond: async () => answered(workReport()) });
	const acceptanceTests = [
		{ criterion: 'the widget renders its label', testFile: 'src/widget.unit.test.ts', testName: 'widget: renders its label', gate: 'test' },
	];

	await runWriterBatches({ run, groups: groupsOf(2), planContent: '# Plan', acceptanceTests });

	// every coverage writer is briefed with the bar, not just the first: any of
	// them could otherwise weaken a case the run has to prove
	expect(prompts.length).toBe(2);
	expect(prompts.every((prompt) => prompt.includes('- `widget: renders its label` in src/widget.unit.test.ts'))).toBeTruthy();
});

test('runWriterBatches: a run whose plan carries no ledger briefs its writers with no acceptance section', async () => {
	const { run, prompts } = setupWriterRun({ respond: async () => answered(workReport()) });

	await runWriterBatches({ run, groups: groupsOf(1), planContent: '# Plan' });

	// the section is omitted, not emitted empty
	expect(prompts[0]?.includes('# Acceptance tests')).toBeFalsy();
});

test('runWriterBatches: chunks of one oversized component run at the same time', async () => {
	const { run, log } = setupWriterRun({
		respond: async ({ onFirstEvent }) => {
			if (onFirstEvent) {
				onFirstEvent();
				await delay(40);
			}

			return answered(workReport());
		},
	});
	// The oversized-component case: one component split into two chunks, which
	// share no file. Nothing excludes them from each other.
	const groups: TestTargetGroup[] = [{ files: ['src/chunk1.ts'] }, { files: ['src/chunk2.ts'] }];

	const { reports, parked } = await runWriterBatches({ run, groups, planContent: '# Plan' });

	expect(parked).toBe(false);
	expect(reports.length).toBe(2);
	// the second chunk is in flight before the first settles
	expect(log.indexOf('start:src/chunk2.ts')).toBeLessThan(log.indexOf('end:src/chunk1.ts'));
});

test('runWriterBatches: a writer that throws surfaces its error only once the writers beside it have settled', async () => {
	const { run, log } = setupWriterRun({
		respond: async ({ file, onFirstEvent }) => {
			if (onFirstEvent) {
				onFirstEvent();
				await delay(60);

				return answered(workReport());
			}

			if (file === 'src/thrower.ts') {
				throw new Error('harness crashed');
			}

			await delay(60);

			return answered(workReport());
		},
	});
	// The thrower dies while both of its siblings are mid-flight: the step may
	// not reject while a harness process is still live.
	const groups: TestTargetGroup[] = [{ files: ['src/warm.ts'] }, { files: ['src/thrower.ts'] }, { files: ['src/sibling.ts'] }];

	const settled = await runWriterBatches({ run, groups, planContent: '# Plan' }).then(
		() => ({ message: 'resolved', seen: [...log] }),
		(error: unknown) => ({ message: messageOf({ error }), seen: [...log] }),
	);

	expect(settled.message).toBe('harness crashed');
	// both siblings had already settled at the moment the error surfaced
	expect(settled.seen).toEqual(expect.arrayContaining(['end:src/warm.ts', 'end:src/sibling.ts']));
});

test('runWriterBatches: two writers that throw surface the error of the one that died first', async () => {
	const { run, log } = setupWriterRun({
		respond: async ({ file, onFirstEvent }) => {
			if (onFirstEvent) {
				onFirstEvent();
				await delay(60);

				return answered(workReport());
			}

			await delay(file === 'src/early.ts' ? 10 : 30);

			throw new Error(file === 'src/early.ts' ? 'early crashed' : 'late crashed');
		},
	});
	// Two throwers with staggered deaths: the second must not overwrite the
	// error the step is holding for the caller.
	const groups: TestTargetGroup[] = [{ files: ['src/warm.ts'] }, { files: ['src/early.ts'] }, { files: ['src/late.ts'] }];

	const settled = await runWriterBatches({ run, groups, planContent: '# Plan' }).then(
		() => ({ message: 'resolved', seen: [...log] }),
		(error: unknown) => ({ message: messageOf({ error }), seen: [...log] }),
	);

	// the earlier death wins, and the later thrower had still been given its slot
	expect(settled.message).toBe('early crashed');
	expect(settled.seen).toEqual(expect.arrayContaining(['start:src/late.ts', 'end:src/warm.ts']));
});
