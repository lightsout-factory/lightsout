import { join } from 'node:path';

interface Params {
	cwd: string;
}

/** Recorded so a newer question can cut off the reading still playing. */
export const getVoicePidPath = ({ cwd }: Params): string => {
	return join(cwd, '.lightsout', 'voice-pid');
};
