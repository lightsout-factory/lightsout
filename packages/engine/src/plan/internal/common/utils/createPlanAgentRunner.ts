import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { z } from 'zod';
import type { ActivityLevel } from '#src/common/types/ActivityLevel.ts';
import type { AgentOutcome } from '#src/common/types/AgentOutcome.ts';
import { createEventFileSink } from '#src/common/utils/createEventFileSink.ts';
import { getDirsOutsideCwd } from '#src/common/utils/getDirsOutsideCwd.ts';
import { ActivityLevelKind } from '#src/contracts/activity/ActivityLevelKind.ts';
import type { Effort } from '#src/contracts/Effort.ts';
import type { Permissions } from '#src/contracts/Permissions.ts';
import type { AgentEnvironment } from '#src/drivers/common/types/AgentEnvironment.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import { getAgentOutcomeStatus } from '#src/invoke/getAgentOutcomeStatus.ts';
import { invokeAgentWithContract } from '#src/invoke/invokeAgentWithContract/invokeAgentWithContract.ts';

interface Params {
	cwd: string;
	driver: Driver;
	workspaceDir: string;
	/** Names the evidence files: `<step>-stream.jsonl` and `<step>-rejected-*.txt`. */
	step: string;
	model?: string;
	effort?: Effort;
	permissions?: Permissions;
	timeoutMs?: number;
	/** Defaults to the chokepoint's own default of one. */
	maxRoleAttempts?: number;
	environment?: AgentEnvironment;
	level?: ActivityLevel;
}

/**
 * Keyed by cwd and plan folder. A fan-out builds one runner per plan file, and
 * every one of them awaits this one lookup, so they resume — and spawn — in the
 * order they started rather than in whichever order separate lookups finish.
 */
const writableDirsByFolder = new Map<string, Promise<string[]>>();

const getWritableDirs = ({ cwd, workspaceDir }: { cwd: string; workspaceDir: string }) => {
	const key = `${cwd}\0${workspaceDir}`;
	const known = writableDirsByFolder.get(key);
	const writableDirs = known ?? getDirsOutsideCwd({ cwd, dirs: [workspaceDir] });

	writableDirsByFolder.set(key, writableDirs);

	return writableDirs;
};

interface CallParams<Contract extends z.ZodType> {
	invocation: { systemPrompt: string; prompt: string };
	contract: Contract;
	/** Distinguishes rejected payloads when a step invokes the agent once per plan file. */
	label?: string;
	allowedCommands?: string[];
}

/**
 * The transcript sink is created once per step rather than per call, so a step
 * that invokes the agent per plan file still produces one ordered transcript.
 * The rejected-payload name carries the chokepoint's spawn number, which keeps
 * rising across fresh role attempts, so a step that raised `maxRoleAttempts`
 * does not overwrite its own evidence.
 *
 * Classifying the outcome stays with the caller: a rate limit and a failure
 * mean different things per step.
 *
 * The step LEVEL, unlike the sink, is opened per call: a level has to end when
 * its call ends, and a runner has no disposal hook to end one on.
 *
 * The plan folder lies under the primary checkout, so an agent running in a
 * planning worktree is granted it as a writable directory, resolved once per
 * cwd and plan folder since neither path changes over a planning command's life.
 */
export const createPlanAgentRunner = ({
	cwd,
	driver,
	workspaceDir,
	step,
	model,
	effort,
	permissions,
	timeoutMs,
	maxRoleAttempts,
	environment,
	level,
}: Params): (<Contract extends z.ZodType>(params: CallParams<Contract>) => Promise<AgentOutcome<z.infer<Contract>>>) => {
	const onEvent = createEventFileSink({ path: join(workspaceDir, `${step}-stream.jsonl`) });
	const writableDirs = getWritableDirs({ cwd, workspaceDir });

	return async <Contract extends z.ZodType>({ invocation, contract, label, allowedCommands }: CallParams<Contract>) => {
		const stepLevel = level?.open({ level: ActivityLevelKind.Step, label: label === undefined ? step : `${step}-${label}` });
		const outcome = await invokeAgentWithContract({
			driver,
			cwd,
			invocation,
			contract,
			model,
			effort,
			permissions,
			timeoutMs,
			maxRoleAttempts,
			allowedCommands,
			writableDirs: await writableDirs,
			environment,
			onEvent,
			onRejectedOutput: async ({ text, attempt }) => {
				const name = `${step}-rejected-${label === undefined ? '' : `${label}-`}${attempt}.txt`;

				await writeFile(join(workspaceDir, name), text, 'utf8').catch(() => undefined);
			},
			activity: stepLevel,
		});

		stepLevel?.close({ outcome: getAgentOutcomeStatus({ outcome }) });

		return outcome;
	};
};
