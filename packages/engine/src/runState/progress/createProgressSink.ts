import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createEventFileSink } from '#src/common/createEventFileSink.ts';
import { getProgressLogPath } from '#src/runState/progress/common/getProgressLogPath.ts';

interface Params {
	cwd: string;
	runId: string;
}

/**
 * The run's folder is looked up inside the sink's `ready` promise rather than
 * awaited here, because `RunState` builds this in its constructor, which cannot
 * await.
 *
 * @returns A synchronous call that never throws: persisting narration must never
 * fail a run.
 */
export const createProgressSink = ({ cwd, runId }: Params): ((message: string) => void) => {
	const logPath = getProgressLogPath({ cwd, runId });
	const sink = createEventFileSink({ path: logPath, ready: logPath.then((path) => mkdir(dirname(path), { recursive: true })) });

	return (message) => {
		sink({ at: new Date().toISOString(), message });
	};
};
