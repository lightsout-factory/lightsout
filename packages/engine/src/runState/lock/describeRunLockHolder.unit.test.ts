import { describe, expect, test } from '@jest/globals';
import type { RunLock } from '#src/contracts/run/RunLock.ts';
import { describeRunLockHolder } from '#src/runState/lock/describeRunLockHolder.ts';

const setupHolder = () => {
	const holder: RunLock = { pid: 4242, runId: 'run-a', startedAt: '2026-01-01T00:00:00.000Z' };

	return { holder };
};

describe('describeRunLockHolder', () => {
	test('names the holding run, its pid, its start and the lock file to delete only when nothing runs', () => {
		const { holder } = setupHolder();

		const sentence = describeRunLockHolder({ holder });

		expect(sentence).toContain('run-a');
		expect(sentence).toContain('4242');
		expect(sentence).toContain('2026-01-01T00:00:00.000Z');
		expect(sentence).toContain('.lightsout/lock.json');
	});
});
