/**
 * A steady ceiling on concurrent read-only plan agents across a whole pass, not
 * a batch size. The bound is the API rate limit, not the machine. It sits above
 * `planDraftConcurrency` because these are short read-only passes, not long
 * authoring turns.
 */
export const planAgentConcurrency = 12;
