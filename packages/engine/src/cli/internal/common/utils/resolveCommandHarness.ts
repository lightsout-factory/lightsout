import type { Effort } from '#src/contracts/Effort.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';

interface Params {
	config: LightsoutConfig | undefined;
	/** Which lightsout command is resolving — selects the config's per-command entry. */
	command: keyof NonNullable<LightsoutConfig['commands']>;
}

/**
 * The global `model` falls through only when the command resolves to the global
 * harness, because a model name is meaningful only to its own harness. The
 * global `effort` always falls through: the levels mean the same on every
 * harness.
 */
export const resolveCommandHarness = ({ config, command }: Params): { driverName: string; model: string | undefined; effort: Effort | undefined } => {
	const entry = config?.commands?.[command];
	const globalHarnessName = config?.harness ?? 'claude-code';
	const driverName = entry?.harness ?? globalHarnessName;
	const model = entry?.model ?? (driverName === globalHarnessName ? config?.model : undefined);
	const effort = entry?.effort ?? config?.effort;

	return { driverName, model, effort };
};
