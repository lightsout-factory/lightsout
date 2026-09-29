/**
 * Thrown before any manifest exists, so the CLI prints the message without a
 * stack and without leaving an orphan run directory.
 */
export class RunLockError extends Error {}
