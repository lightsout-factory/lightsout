import { readFile, rm } from 'node:fs/promises';
import { getVoicePidPath } from '#src/voice/common/getVoicePidPath.ts';

interface Params {
	cwd: string;
}

/** A pid that has already exited is the ordinary case — the reading finished on its own — so the kill is best-effort. */
export const stopSpeech = async ({ cwd }: Params): Promise<void> => {
	const pidPath = getVoicePidPath({ cwd });
	const raw = await readFile(pidPath, 'utf8').catch(() => undefined);

	if (raw === undefined) {
		return;
	}

	const pid = Number(raw.trim());

	if (Number.isInteger(pid) && pid > 0) {
		try {
			process.kill(pid);
		} catch {
			// already finished
		}
	}

	await rm(pidPath, { force: true });
};
