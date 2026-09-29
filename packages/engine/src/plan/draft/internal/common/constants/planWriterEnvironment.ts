import type { AgentEnvironment } from '#src/drivers/common/types/AgentEnvironment.ts';
import { planWriterTools } from '#src/plan/draft/internal/common/constants/planWriterTools.ts';

/**
 * The focused plan-writer's environment request, composed once.
 *
 * Three of the four properties are asked for positively — no MCP server loaded,
 * no skill or slash-command catalogue loaded, and the built-in tool set
 * restricted to `planWriterTools`. The fourth is expressed by what this record
 * does NOT carry: no model, no effort, no permission level. Those already reach
 * the driver from the config, and a second copy here would be the harness-wide
 * "minimal mode" the focused environment deliberately is not.
 *
 * A harness applies the controls it can express and runs the rest as an
 * ordinary session: the controls save tokens, and the plan is the same without
 * them.
 */
export const planWriterEnvironment: AgentEnvironment = {
	noMcpServers: true,
	noSkillCatalog: true,
	toolAllowlist: true,
	settingsPreserved: true,
	tools: planWriterTools,
};
