import type { z } from 'zod';
import type { ActivityLevel } from '#src/activity/common/types/ActivityLevel.ts';
import { buildReportReemitterInvocation } from '#src/agents/buildReportReemitterInvocation.ts';
import type { HarnessProcessUsage } from '#src/contracts/activity/HarnessProcessUsage.ts';
import type { Effort } from '#src/contracts/Effort.ts';
import type { Permissions } from '#src/contracts/Permissions.ts';
import type { AgentUsage } from '#src/contracts/run/AgentUsage.ts';
import type { AgentEnvironment } from '#src/drivers/common/types/AgentEnvironment.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import type { AgentOutcome } from '#src/invoke/common/types/AgentOutcome.ts';
import { extractJsonReport } from '#src/invoke/extractJsonReport.ts';
import { recordHarnessProcess } from '#src/invoke/internal/common/utils/recordHarnessProcess.ts';

/**
 * Stays `undefined` until some rung reports usage, so a harness that reports
 * nothing is recorded as nothing rather than as zero. Summed per field, because
 * a process killed before its terminal result event has token counts and no cost.
 */
const sumUsage = ({ total, rungUsage }: { total?: AgentUsage; rungUsage?: HarnessProcessUsage }) => {
	const { inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, costUsd } = rungUsage ?? {};

	if ([inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, costUsd].every((reported) => reported === undefined)) {
		return total;
	}

	const base = total ?? { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, costUsd: 0 };

	return {
		inputTokens: base.inputTokens + (inputTokens ?? 0),
		outputTokens: base.outputTokens + (outputTokens ?? 0),
		cacheReadTokens: base.cacheReadTokens + (cacheReadTokens ?? 0),
		cacheCreationTokens: base.cacheCreationTokens + (cacheCreationTokens ?? 0),
		costUsd: base.costUsd + (costUsd ?? 0),
	};
};

/**
 * Asking an agent to restate an empty or one-line error message as a report
 * cannot succeed, so a rejection holding no object does not earn a re-emit. A
 * caller on the default ceiling of 1 keeps its re-emit regardless.
 */
const shouldReemit = ({ payload, maxRoleAttempts }: { payload: unknown; maxRoleAttempts: number }) =>
	maxRoleAttempts === 1 || (typeof payload === 'object' && payload !== null);

/**
 * `usage` is threaded onto the outcome once, at the single exit, so no rung can
 * return an outcome that under-reports what the call burned.
 */
type LadderResult<Report> = { ok: true; report: Report } | { ok: false; failure: string; rateLimited: boolean };

interface Params<Contract extends z.ZodType> {
	driver: Driver;
	cwd: string;
	invocation: { systemPrompt: string; prompt: string };
	contract: Contract;
	model?: string;
	effort?: Effort;
	permissions?: Permissions;
	timeoutMs?: number;
	/** Consumer-granted command prefixes, relayed to the driver's allowed-tools mechanism. */
	allowedCommands?: string[];
	/**
	 * A focused role's requested agent environment, relayed onto every rung of the
	 * ladder. The re-emit rung carries the same one as the role rung: it runs
	 * against the same harness process shape, and a differently-equipped retry
	 * would be a second, untested environment.
	 */
	environment?: AgentEnvironment;
	/**
	 * A request that every shell command the agent starts finishes inside its
	 * turn, relayed onto every rung including the re-emit, for the same reason
	 * `environment` is: a re-emit rung is the same harness process shape.
	 */
	foregroundCommandsOnly?: boolean;
	/**
	 * Directories outside `cwd` the session must be able to write, relayed onto
	 * every rung, the re-emit rung included, for the same reason `environment` is.
	 */
	writableDirs?: string[];
	/**
	 * Fresh role invocations this call may spend before giving up on the
	 * contract — the re-run ceiling. Defaults to 1: one role invocation plus its
	 * one cheap re-emit. Only the plan grade readers raise it, because a reader
	 * written off costs a whole graded pass while every other role's failure
	 * costs one step.
	 */
	maxRoleAttempts?: number;
	/** Relayed to the driver: one call per harness stream event (transcript tee, progress narration). */
	onEvent?: (event: unknown) => void;
	/** Called with the raw final message whenever it fails the contract — the caller persists it as run evidence. */
	onRejectedOutput?: (params: { text: string; attempt: number; validationError: string }) => Promise<void> | void;
	/** The level each of this call's harness processes is recorded under. Omitted wherever no run is being recorded. */
	activity?: ActivityLevel;
}

/**
 * A malformed payload is rejected by the contract — never hand-parsed around —
 * and retried cheaply first with a re-emit carrying the rejected text, not a
 * re-run of the whole role prompt. Rejected messages reach `onRejectedOutput`
 * under a spawn number that never restarts, so no rung overwrites an earlier
 * rung's evidence.
 */
export const invokeAgentWithContract = async <Contract extends z.ZodType>({
	driver,
	cwd,
	invocation,
	contract,
	model,
	effort,
	permissions,
	timeoutMs,
	allowedCommands,
	environment,
	foregroundCommandsOnly,
	writableDirs,
	maxRoleAttempts = 1,
	onEvent,
	onRejectedOutput,
	activity,
}: Params<Contract>): Promise<AgentOutcome<z.infer<Contract>>> => {
	// The starting value is what a ceiling below one returns — a ladder with no
	// rungs says so rather than throwing at a value no caller passes — and every
	// contract rejection overwrites it, so a ladder that runs out ends carrying
	// the last rung's reason.
	let settled: LadderResult<z.infer<Contract>> = { ok: false, failure: 'no attempts made', rateLimited: false };
	let rejected: { rejectedText: string; validationError: string } | undefined;
	let usage: AgentUsage | undefined;
	let attempt = 0;
	let roleAttempts = 0;

	// The second clause is what lets the last role invocation still spend its
	// re-emit after the ceiling is used up.
	while (roleAttempts < maxRoleAttempts || rejected !== undefined) {
		const isReemit = rejected !== undefined;
		const active = rejected ? { systemPrompt: invocation.systemPrompt, prompt: buildReportReemitterInvocation(rejected).prompt } : invocation;

		if (!isReemit) {
			roleAttempts += 1;
		}

		attempt += 1;

		const rung = await recordHarnessProcess({
			driver,
			invocation: { ...active, cwd, model, effort, permissions, timeoutMs, allowedCommands, writableDirs, environment, foregroundCommandsOnly, onEvent },
			activity,
			spawn: attempt,
			reemit: isReemit,
		});

		// Above the failure break: a killed spawn still burned what it streamed.
		usage = sumUsage({ total: usage, rungUsage: rung.usage });

		if (!rung.ok) {
			settled = { ok: false, failure: rung.failure, rateLimited: false };

			break;
		}

		if (rung.result.rateLimited) {
			settled = { ok: false, failure: 'harness rate limited or overloaded', rateLimited: true };

			break;
		}

		const payload = extractJsonReport({ text: rung.result.text });
		const parsed = contract.safeParse(payload);

		if (parsed.success) {
			settled = { ok: true, report: parsed.data };

			break;
		}

		settled = { ok: false, failure: `agent output did not match contract (exit ${rung.result.exitCode}): ${parsed.error.message}`, rateLimited: false };
		await onRejectedOutput?.({ text: rung.result.text, attempt, validationError: parsed.error.message });
		// A re-emit that also failed has spent this role invocation's one cheap
		// recovery — the next rung is a fresh role prompt, or the end of the ladder.
		rejected = isReemit || !shouldReemit({ payload, maxRoleAttempts }) ? undefined : { rejectedText: rung.result.text, validationError: parsed.error.message };
	}

	return { ...settled, usage };
};
