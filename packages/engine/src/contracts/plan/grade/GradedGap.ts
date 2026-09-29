import { z } from 'zod';
import { GapObservation } from '#src/contracts/plan/grade/GapObservation.ts';
import { GapOutcome } from '#src/contracts/plan/grade/GapOutcome.ts';
import { GapVerdict } from '#src/contracts/plan/grade/GapVerdict.ts';

/**
 * The engine stamps the phase and the lens after the reader returns, so an
 * agent can neither mislabel a gap's phase nor claim a lens it was not given.
 */
export const GradedGap = GapObservation.extend({
	...GapVerdict.omit({ outcome: true, matchesFinding: true }).shape,
	/** Widened from the judge's three: `unjudged` is the engine's stamp and never the judge's to claim. */
	outcome: z.enum(GapOutcome),
	/** Why nobody settled it, absent when a judge did. */
	unjudgedReason: z.string().optional(),
	/**
	 * The memory record this gap belongs to. `matchesFinding` is deliberately not
	 * carried through: what is persisted is the id the engine resolved, never the
	 * agent's raw claim.
	 */
	findingId: z.string().optional(),
	/** Empty on a single-observation finding — read it through `findingLocations`, which treats empty as the gap's own `phase`. */
	observations: z.array(GapObservation).default([]),
	/**
	 * Shared by every gap one multi-observation ruling covered, so the memory fold
	 * opens one record for a group it has not given a record id yet. Never an agent's to claim.
	 */
	groupId: z.string().optional(),
	/** The judge's statement of the one violated requirement or contradiction a confirmed group's members are. */
	sharedDefect: z.string().optional(),
});

export type GradedGap = z.infer<typeof GradedGap>;
