import type { AgentEnvironment } from '#src/common/types/AgentEnvironment.ts';
import { planWriterTools } from '#src/plan/draft/focused/common/constants/planWriterEnvironment/planWriterTools.ts';

/**
 * Carries no model, effort or permission level: those already reach the driver
 * from the config. A harness applies the controls it can express and runs the
 * rest as an ordinary session — the controls save tokens, the plan is the same.
 */
export const planWriterEnvironment: AgentEnvironment = {
	noMcpServers: true,
	noSkillCatalog: true,
	toolAllowlist: true,
	settingsPreserved: true,
	tools: planWriterTools,
};
