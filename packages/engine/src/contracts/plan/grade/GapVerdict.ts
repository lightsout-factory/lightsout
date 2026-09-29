import { z } from 'zod';
import { GapOutcome } from '#src/contracts/plan/grade/GapOutcome.ts';

/**
 * The three-member enum is deliberately not `z.enum(GapOutcome)`:
 * `GapOutcome.Unjudged` is the engine's stamp for a finding nobody settled, so a
 * judge can never claim it.
 *
 * The evidence fields are optional because only one outcome demands each;
 * `matchGapVerdicts` enforces which, and stamps a verdict that skips its
 * evidence `unjudged` rather than believing it.
 */
export const GapVerdict = z.object({
	outcome: z.enum([GapOutcome.NeedsAHuman, GapOutcome.AgentCanDecide, GapOutcome.AlreadyAnswered]),
	/** `needs-a-human`: the decision the human has to make. */
	humanDecision: z.string().optional(),
	/** `agent-can-decide`: what the implementing agent would decide. */
	agentDecision: z.string().optional(),
	/** `agent-can-decide`: why that decision is safe to make without asking. */
	safeBecause: z.string().optional(),
	/** `already-answered`: where the answer already lives — a line of the plan, a `file:symbol`, or a standards rule. */
	answerAt: z.string().optional(),
	/** The id of a memory record this finding repeats, when the judge recognises one from the records it was given. An id no record holds leaves the finding `unjudged`. */
	matchesFinding: z.string().optional(),
});

export type GapVerdict = z.infer<typeof GapVerdict>;
