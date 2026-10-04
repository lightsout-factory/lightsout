import { buildSupervisorInvocation } from '#src/agents/buildSupervisorInvocation.ts';
import { defaultSupervisorTimeoutMinutes } from '#src/common/constants/defaultSupervisorTimeoutMinutes.ts';
import type { ActivityLevel } from '#src/common/types/ActivityLevel.ts';
import type { AgentOutcome } from '#src/common/types/AgentOutcome.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { Permissions } from '#src/contracts/Permissions.ts';
import { SupervisorVerdict } from '#src/contracts/work/SupervisorVerdict.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import { invokeAgentWithContract } from '#src/invoke/invokeAgentWithContract/invokeAgentWithContract.ts';

const supervisorPermissions = Permissions.ReadOnly;

interface Params {
	driver: Driver;
	cwd: string;
	config: LightsoutConfig;
	/** The plan text (or standalone banner), for the supervisor's context. */
	planContent: string;
	stepId: string;
	/** The verification-gate output that keeps failing. */
	errorOutput: string;
	attempts: number;
	onEvent?: (event: unknown) => void;
	onRejectedOutput?: (params: { text: string; attempt: number; validationError: string }) => Promise<void> | void;
	/** The level this consult's harness processes are recorded under. Absent wherever no run is being recorded. */
	activity?: ActivityLevel;
}

/** Callers own usage recording and the verdict. */
export const consultSupervisor = async ({
	driver,
	cwd,
	config,
	planContent,
	stepId,
	errorOutput,
	attempts,
	onEvent,
	onRejectedOutput,
	activity,
}: Params): Promise<AgentOutcome<SupervisorVerdict>> => {
	return invokeAgentWithContract({
		driver,
		cwd,
		invocation: buildSupervisorInvocation({ planContent, stepId, errorOutput, attempts }),
		contract: SupervisorVerdict,
		model: config.model,
		effort: config.effort,
		permissions: supervisorPermissions,
		timeoutMs: (config.timeouts?.['supervisor-minutes'] ?? defaultSupervisorTimeoutMinutes) * 60_000,
		onEvent,
		onRejectedOutput,
		activity,
	});
};
