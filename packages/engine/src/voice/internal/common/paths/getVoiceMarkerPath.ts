import { join } from 'node:path';

interface Params {
	cwd: string;
}

/** A file, so any process can read the switch. */
export const getVoiceMarkerPath = ({ cwd }: Params): string => {
	return join(cwd, '.lightsout', 'voice-on');
};
