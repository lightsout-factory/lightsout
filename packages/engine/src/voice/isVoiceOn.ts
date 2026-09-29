import { access } from 'node:fs/promises';
import { getVoiceMarkerPath } from '#src/voice/internal/common/paths/getVoiceMarkerPath.ts';

interface Params {
	cwd: string;
}

export const isVoiceOn = async ({ cwd }: Params): Promise<boolean> => {
	return access(getVoiceMarkerPath({ cwd }))
		.then(() => true)
		.catch(() => false);
};
