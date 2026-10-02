import { launchRunIdVariable } from '#src/cli/internal/common/constants/launchRunIdVariable.ts';

interface Params {
	/** The process environment, passed rather than read so a test never mutates `process.env`. */
	env: NodeJS.ProcessEnv;
}

/**
 * The child side of a detached launch. The variable is removed from `env`
 * itself, so no harness, gate or nested engine this process spawns inherits an
 * id meant for this process alone.
 *
 * @returns the run id a detached parent handed this process, or undefined when this process was not launched detached
 */
export const readLaunchRunId = ({ env }: Params): string | undefined => {
	const runId = env[launchRunIdVariable];

	delete env[launchRunIdVariable];

	return runId === '' ? undefined : runId;
};
