import { z } from 'zod';
import { GateOverride } from '#src/contracts/GateOverride.ts';

/**
 * An unlisted checkpoint keeps the engine's default: the cheap gates first, and
 * the expensive ones only once every package group's cheap gates are green.
 * `.strict()` so a misspelled checkpoint fails loudly rather than silently
 * disabling a schedule.
 */
export const GateOverrides = z
	.object({
		/** The baseline gate run, before any agent works — the codebase must already be green. */
		'clean-slate': GateOverride.optional(),
		/** The gate run after the feature executor's implementation. */
		'verify-implement': GateOverride.optional(),
		/** The gate run after the tests are written. */
		'verify-tests': GateOverride.optional(),
		/** The gate run after the refactor pass. */
		'verify-refactor': GateOverride.optional(),
	})
	.strict();

export type GateOverrides = z.infer<typeof GateOverrides>;
