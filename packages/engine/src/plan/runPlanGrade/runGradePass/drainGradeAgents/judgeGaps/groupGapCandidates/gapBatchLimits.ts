/**
 * Caps on a judge batch so one judge prompt never becomes a whole-plan read: a
 * judge is given the full text of every plan file its batch spans.
 *
 * Both bind only the decision to combine findings. A single finding is never
 * split, so one already spanning more than `maxPlanFiles` is a batch of one over
 * the cap rather than a finding nobody can judge.
 */
export const gapBatchLimits = { maxObservations: 8, maxPlanFiles: 3 } as const;
