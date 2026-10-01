import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { writeRunOwner } from '#src/runState/owner/writeRunOwner.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';

// Mocked Imports
// -------------------------
// `ps` reads this process's start time on every platform the suite runs on, so
// only a mock stands in for one where it cannot (no `ps`, as on Windows). The
// record remembers the start time for the life of the module, which is why this
// case lives in its own file rather than beside the readable one.
const mockReadProcessStartTime = jest.fn<(params: { pid: number }) => Promise<string | undefined>>();

jest.mock('#src/common/processes/readProcessStartTime.ts', () => ({
	readProcessStartTime: (params: { pid: number }) => mockReadProcessStartTime(params),
}));
// -------------------------

/** A checkout holding one implement run's folder with no owner record yet, on a machine whose `ps` reads nothing. */
const setupRun = () => {
	mockReadProcessStartTime.mockResolvedValue(undefined);

	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-run-owner-'));
	const runId = 'run-owner-1';
	const runDir = runDirFor({ cwd, runId });

	mkdirSync(runDir, { recursive: true });

	return { cwd, runId, runDir };
};

describe('writeRunOwner', () => {
	test('leaves the start time off the record when it cannot be read', async () => {
		const { cwd, runId, runDir } = setupRun();

		const written = await writeRunOwner({ cwd, runId });

		const onDisk = JSON.parse(readFileSync(join(runDir, 'owner.json'), 'utf8')) as Record<string, unknown>;

		// an unknown start time is no key at all, so a reader falls back to the pid alone
		expect({ written, carriesStartTime: Object.hasOwn(onDisk, 'processStartTime') }).toStrictEqual({
			written: { pid: process.pid, recordedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/) },
			carriesStartTime: false,
		});
	});
});
