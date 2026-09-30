import { messageOf } from './messageOf.mjs';

/**
 * Exit codes are set rather than forced with `process.exit`: stdout is a pipe
 * for every caller that matters, and exiting right after a log discards it.
 */
export const runScript = ({ run }) => {
	try {
		run();
	} catch (error) {
		console.error(`  ${messageOf({ error })}`);
		process.exitCode = 1;
	}
};
