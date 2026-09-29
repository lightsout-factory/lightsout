/**
 * Positional by necessity: a type predicate narrows the argument it is handed
 * by POSITION, so wrapping the value in an object would compile and narrow
 * nothing.
 *
 * Arrays are excluded deliberately: `typeof value === 'object'` lets them
 * through, and a caller reading named fields off one gets undefined for every
 * key rather than an error.
 */
export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
