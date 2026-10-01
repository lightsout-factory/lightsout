import { describe, expect, test } from '@jest/globals';
import { exitForRunResult } from '#src/cli/internal/common/utils/exitForRunResult.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { captureCommandOutput } from '#tests/helpers/captureCommandOutput.ts';
import { manifestOf } from '#tests/helpers/setupResume.ts';

/** A run result and a captured process exit — the mocked exit throws, so the call rejects once it has exited. */
const setupRunResult = ({ ok, status }: { ok: boolean; status: RunStatus }) => {
	const { exitCodes } = captureCommandOutput();
	const manifest = manifestOf({ status });

	return { ok, manifest, exitCodes };
};

describe('exitForRunResult', () => {
	test.each([
		{ ok: false, status: RunStatus.PausedRateLimit, expected: 2 },
		{ ok: true, status: RunStatus.Passed, expected: 0 },
	])('exits with the code the run result maps to', async ({ ok, status, expected }) => {
		const { manifest, exitCodes } = setupRunResult({ ok, status });

		const exiting = exitForRunResult({ ok, manifest });

		await expect(exiting).rejects.toThrow('process.exit');
		expect(exitCodes).toStrictEqual([expected]);
	});
});
