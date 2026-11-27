import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { buildCleanupSummary } from '#src/common/buildCleanupSummary.ts';
import { readJsonlRecords } from '#src/common/json/readJsonlRecords.ts';
import { resolveRunDir } from '#src/common/runs/resolveRunDir.ts';
import type { CleanupSummary } from '#src/common/types/CleanupSummary.ts';
import type { RunSummary } from '#src/common/types/RunSummary.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { readFriction } from '#src/runState/friction/readFriction.ts';
import { isSelfCheckStep } from '#src/runState/summarizeRun/isSelfCheckStep.ts';

const LedgerRecord = z.object({
	step: z.string(),
	outputTokens: z.number(),
	costUsd: z.number(),
});

const CommandRecord = z.object({
	/** The pipeline step the execution was recorded under; absent on a record written outside a step. */
	step: z.string().optional(),
	kind: z.string().optional(),
	group: z.string().optional(),
	exitCode: z.number().optional(),
	testResultsDir: z.string().optional(),
	durationMs: z.number().optional(),
	rerun: z.literal(true).optional(),
	skipped: z.literal(true).optional(),
	crashed: z.literal(true).optional(),
	timedOut: z.literal(true).optional(),
});

type CommandRecord = z.infer<typeof CommandRecord>;

const sameGate = ({ a, b }: { a: CommandRecord; b: CommandRecord }) => a.kind === b.kind && a.group === b.group;

/**
 * A gate run that failed for real: not a rerun, not a crash or a timeout, and not a flake the
 * next execution of the same gate passed on its rerun.
 */
const isFailedGateRun = ({ commands, index }: { commands: CommandRecord[]; index: number }) => {
	const command = commands[index];

	if (!command || command.skipped || command.rerun || command.crashed || command.timedOut || (command.exitCode ?? 0) === 0) {
		return false;
	}

	const next = commands.slice(index + 1).find((later) => !later.skipped && sameGate({ a: later, b: command }));

	return !(next?.rerun && next.exitCode === 0);
};

/** A failed gate run some later execution of the same gate passed, a rerun aside. */
const isFixedLater = ({ commands, index }: { commands: CommandRecord[]; index: number }) => {
	const command = commands[index];
	const later = commands.slice(index + 1);

	return command !== undefined && later.some((next) => !next.skipped && !next.rerun && next.exitCode === 0 && sameGate({ a: next, b: command }));
};

/** Each gate execution that recorded a results directory, once per step, group and kind. */
const listTestResultExecutions = ({ commands }: { commands: CommandRecord[] }) => {
	const executions = new Map<string, RunSummary['testResultExecutions'][number]>();

	for (const { step, group, kind, testResultsDir } of commands) {
		const key = JSON.stringify([step, group, kind]);

		if (testResultsDir !== undefined && step !== undefined && group !== undefined && kind !== undefined && !executions.has(key)) {
			executions.set(key, { step, group, kind });
		}
	}

	return [...executions.values()];
};

/** Each figure is counted over the run's own gate work; self-checks are only counted, as their own figure. */
const summarizeGates = ({ commands, selfChecks }: { commands: CommandRecord[]; selfChecks: CommandRecord[] }) => {
	const failed = commands.flatMap((_, index) => (isFailedGateRun({ commands, index }) ? [index] : []));

	return {
		gates: {
			commands: commands.filter((command) => !command.skipped).length,
			reruns: commands.filter((command) => command.rerun).length,
			skipped: commands.filter((command) => command.skipped).length,
			failed: failed.length,
			fixed: failed.filter((index) => isFixedLater({ commands, index })).length,
			selfChecks: selfChecks.filter((command) => !command.skipped).length,
		},
		testResultExecutions: listTestResultExecutions({ commands }),
	};
};

interface Params {
	cwd: string;
	manifest: RunManifest;
}

/**
 * Computed from what the run already persisted: the summary is a view, never a
 * second source of truth. Supervisor invocations are attributed to the step
 * they supervised.
 */
export const summarizeRun = async ({ cwd, manifest }: Params): Promise<RunSummary> => {
	const runDir = await resolveRunDir({ cwd, runId: manifest.runId });
	const ledger = await readJsonlRecords({ path: join(runDir, 'agents.jsonl'), schema: LedgerRecord });
	// A writing agent's own self-check runs the run's gate commands and records
	// them like any other execution, but it is not the run's gate work: leaving it
	// in would inflate the very figures a reader compares a run against.
	const recorded = await readJsonlRecords({ path: join(runDir, 'commands.jsonl'), schema: CommandRecord });
	const commands = recorded.filter((command) => !isSelfCheckStep({ step: command.step }));
	const selfChecks = recorded.filter((command) => isSelfCheckStep({ step: command.step }));
	const agentFiles: string[] = await readdir(join(runDir, 'agents')).catch(() => []);
	const friction = (await readFriction({ cwd })).filter((entry) => entry.runId === manifest.runId);

	const perStepUsage = new Map<string, { invocations: number; outputTokens: number; costUsd: number }>();

	for (const record of ledger) {
		const step = record.step.endsWith('-supervisor') ? record.step.slice(0, -'-supervisor'.length) : record.step;
		const totals = perStepUsage.get(step) ?? { invocations: 0, outputTokens: 0, costUsd: 0 };

		totals.invocations += 1;
		totals.outputTokens += record.outputTokens;
		totals.costUsd += record.costUsd;
		perStepUsage.set(step, totals);
	}

	const frictionByArea = new Map<string, number>();
	const verificationRepairs = new Map<string, number>();

	for (const entry of friction) {
		frictionByArea.set(entry.area, (frictionByArea.get(entry.area) ?? 0) + 1);
	}

	for (const step of manifest.steps) {
		for (const [gateFamily, attempts] of Object.entries(step.verification?.repairAttempts ?? {})) {
			verificationRepairs.set(gateFamily, (verificationRepairs.get(gateFamily) ?? 0) + attempts);
		}
	}

	const cleanup = manifest.steps.reduce<CleanupSummary | undefined>((found, step) => buildCleanupSummary({ step }) ?? found, undefined);
	const { usage } = manifest;
	const readableInput = usage ? usage.cacheReadTokens + usage.cacheCreationTokens + usage.inputTokens : 0;

	return {
		wallMs: Math.max(0, Date.parse(manifest.updatedAt) - Date.parse(manifest.createdAt)),
		activeMs: manifest.steps.reduce((total, step) => total + (step.durationMs ?? 0), 0),
		gateMs: commands.reduce((total, command) => total + (command.durationMs ?? 0), 0),
		usage,
		cacheReadShare: usage && readableInput > 0 ? usage.cacheReadTokens / readableInput : undefined,
		steps: manifest.steps.map((step) => ({
			id: step.id,
			status: step.status,
			attempts: step.attempts,
			durationMs: step.durationMs,
			changedFiles: step.changedFiles,
			...(perStepUsage.get(step.id) ?? { invocations: 0, outputTokens: 0, costUsd: 0 }),
		})),
		...summarizeGates({ commands, selfChecks }),
		verificationRepairs: [...verificationRepairs.entries()].map(([gateFamily, attempts]) => ({ gateFamily, attempts })),
		cleanup,
		rejectedReports: agentFiles.filter((name) => name.startsWith('rejected-')).length,
		frictionByArea: [...frictionByArea.entries()].map(([area, count]) => ({ area, count })),
	};
};
