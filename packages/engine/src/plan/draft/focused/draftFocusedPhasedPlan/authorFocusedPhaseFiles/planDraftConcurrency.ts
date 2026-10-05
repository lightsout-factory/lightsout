/**
 * A steady ceiling on concurrent phase-authoring agents, not a batch size. The
 * bound is the API rate limit, not the machine: a rate-limited spawn parks the
 * whole draft for a human to resume.
 */
export const planDraftConcurrency = 8;
