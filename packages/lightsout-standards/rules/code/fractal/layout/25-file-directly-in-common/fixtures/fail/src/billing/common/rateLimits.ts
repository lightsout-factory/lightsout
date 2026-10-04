// Incorrect: a constant sitting directly in common/. It belongs in
// common/constants/.
export const rateLimits = { min: 0, max: 1 } as const;
