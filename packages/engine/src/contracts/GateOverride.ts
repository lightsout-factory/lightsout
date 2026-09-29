import { z } from 'zod';
import { uncheckpointableGateKeys } from '#src/contracts/common/constants/uncheckpointableGateKeys.ts';

/**
 * A list replaces the engine's schedule entirely, with no tiering. An empty list
 * is refused rather than read as a second spelling of `'off'`. The refusal is
 * the array branch's aborting `.min(1)` rather than a refinement, so an empty
 * list fails both branches and the error names both spellings the author could
 * have meant.
 *
 * Which names a list may hold is checked by `validateGateOverrideNames` on
 * `LightsoutConfig`, where all three gate blocks are visible at once.
 */
export const GateOverride: z.ZodType<'off' | string[]> = z
	.union([
		z.literal('off'),
		z.array(z.string()).min(1, {
			error: 'a gate-overrides list must name at least one gate — write "off" to run no gates at all at this checkpoint',
			abort: true,
		}),
	])
	.superRefine((entry, ctx) => {
		if (entry === 'off') {
			return;
		}

		for (const [name, message] of Object.entries(uncheckpointableGateKeys)) {
			if (entry.includes(name)) {
				ctx.addIssue({ code: 'custom', message });
			}
		}

		const seen = new Set<string>();
		const reported = new Set<string>();

		for (const name of entry) {
			if (seen.has(name) && !reported.has(name)) {
				reported.add(name);
				ctx.addIssue({
					code: 'custom',
					message: `gate '${name}' is named more than once in this gate-overrides list — a gate runs once per checkpoint, so a repeat is a typo`,
				});
			}

			seen.add(name);
		}
	});

export type GateOverride = z.infer<typeof GateOverride>;
