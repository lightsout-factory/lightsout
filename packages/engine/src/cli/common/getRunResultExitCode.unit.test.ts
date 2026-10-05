import { describe, expect, test } from '@jest/globals';
import { getRunResultExitCode } from '#src/cli/common/getRunResultExitCode.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { manifestOf } from '#tests/helpers/setupResume.ts';

/** One result per kind of ending: passed whatever the status, paused at a wall or a ceiling, and failed or escalated. */
const setupResults = () => {
	const results = [
		{ name: 'passed', ok: true, manifest: manifestOf({ status: RunStatus.Passed }) },
		{ name: 'ok with a paused status', ok: true, manifest: manifestOf({ status: RunStatus.PausedBudget }) },
		{ name: 'ok with a failed status', ok: true, manifest: manifestOf({ status: RunStatus.Failed }) },
		{ name: 'paused at a rate limit', ok: false, manifest: manifestOf({ status: RunStatus.PausedRateLimit }) },
		{ name: 'paused at a budget', ok: false, manifest: manifestOf({ status: RunStatus.PausedBudget }) },
		{ name: 'failed', ok: false, manifest: manifestOf({ status: RunStatus.Failed }) },
		{ name: 'escalated', ok: false, manifest: manifestOf({ status: RunStatus.Escalated }) },
	];

	return { results };
};

describe('getRunResultExitCode', () => {
	test('maps a passed, paused and failed run to 0, 2 and 1', () => {
		const { results } = setupResults();

		const codes = results.map(({ name, ok, manifest }) => ({ name, code: getRunResultExitCode({ ok, manifest }) }));

		expect(codes).toStrictEqual([
			{ name: 'passed', code: 0 },
			{ name: 'ok with a paused status', code: 0 },
			{ name: 'ok with a failed status', code: 0 },
			{ name: 'paused at a rate limit', code: 2 },
			{ name: 'paused at a budget', code: 2 },
			{ name: 'failed', code: 1 },
			{ name: 'escalated', code: 1 },
		]);
	});
});
