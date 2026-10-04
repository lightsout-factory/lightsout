import { exitCli } from '#src/cli/common/utils/exitCli.ts';
import { resolveRunId } from '#src/cli/internal/common/utils/resolveTypedRunId/resolveRunId.ts';
import { RunNotFoundError } from '#src/runState/RunNotFoundError.ts';

interface Params {
	cwd: string;
	runId: string;
}

/**
 * Resolves a run id the user typed, full or short. An unknown run id the user
 * typed is a message and exit 1, never a stack trace; any other failure is
 * rethrown.
 *
 * @param cwd - the repository whose runs are searched
 * @param runId - the id as the user typed it
 */
export const resolveTypedRunId = ({ cwd, runId }: Params): Promise<string> =>
	resolveRunId({ cwd, runId }).catch((error: unknown) => {
		if (error instanceof RunNotFoundError) {
			console.error(error.message);
			return exitCli({ code: 1 });
		}

		throw error;
	});
