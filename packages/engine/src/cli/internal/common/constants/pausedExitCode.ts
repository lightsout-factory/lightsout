/**
 * A batched run that stopped with work left and can be picked up again — a
 * `--max-batches` ceiling or a harness rate-limit wall — is neither a failure
 * nor completion, so it needs its own exit code.
 */
export const pausedExitCode = 2;
