import { rm } from 'node:fs/promises';
import { getVoiceMarkerPath } from '#src/voice/internal/common/paths/getVoiceMarkerPath.ts';

interface Params {
	cwd: string;
}

export const deleteVoiceMarker = async ({ cwd }: Params): Promise<void> => {
	await rm(getVoiceMarkerPath({ cwd }), { force: true });
};
