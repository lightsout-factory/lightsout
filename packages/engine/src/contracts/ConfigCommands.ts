import { z } from 'zod';
import { Effort } from '#src/contracts/Effort.ts';

const commandHarness = z
	.object({
		/** Harness name for this command ('claude-code', 'codex', 'omp' or 'pi'). Falls back to the global `harness`. */
		harness: z.string().optional(),
		/** Model for this command's harness. The global `model` falls through only when this command resolves to the global harness. */
		model: z.string().optional(),
		/** Reasoning effort for this command. Falls back to the global `effort` regardless of which harness the command selects — the five levels mean the same thing everywhere. */
		effort: z.enum(Effort).optional(),
	})
	.strict();

/**
 * `plan` covers draft, dedup and grade; `resume` always keeps the run manifest's
 * recorded harness. Both objects are `.strict()` so a typoed key fails parsing
 * instead of silently disabling an override.
 */
export const ConfigCommands = z
	.object({
		implement: commandHarness.optional(),
		refactor: commandHarness.optional(),
		improve: commandHarness.optional(),
		plan: commandHarness.optional(),
		'test-coverage-to-threshold': commandHarness.optional(),
	})
	.strict();

export type ConfigCommands = z.infer<typeof ConfigCommands>;
