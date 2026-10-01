import { jest } from '@jest/globals';

interface Params {
	signals: 'real' | 'refused' | 'failing' | 'unanswered';
}

const throwOnSigterm = ({ kill, errno }: { kill: jest.SpiedFunction<typeof process.kill>; errno: string }) =>
	kill.mockImplementation((_pid: number, signal?: string | number): true => {
		if (signal === 'SIGTERM' || signal === 15) {
			throw Object.assign(new Error(`kill ${errno}`), { code: errno });
		}

		return true;
	});

/**
 * A spied `process.kill`, answering as the case needs: through to the system,
 * refusing SIGTERM as another user's pid, failing SIGTERM with an errno stop
 * cannot read, or accepting every signal without effect.
 *
 * @param signals - how the system answers a signal
 */
export const spyOnProcessKill = ({ signals }: Params): jest.SpiedFunction<typeof process.kill> => {
	const kill = jest.spyOn(process, 'kill');

	if (signals === 'refused') {
		throwOnSigterm({ kill, errno: 'EPERM' });
	}

	if (signals === 'failing') {
		throwOnSigterm({ kill, errno: 'EINVAL' });
	}

	if (signals === 'unanswered') {
		kill.mockImplementation((_pid: number, _signal?: string | number): true => true);
	}

	return kill;
};
