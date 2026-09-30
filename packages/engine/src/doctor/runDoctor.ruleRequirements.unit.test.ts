import { expect, test } from '@jest/globals';
import { runDoctor } from '#src/doctor/runDoctor.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';

const passingProbe = async () => ({ exitCode: 0, stdout: '2.1.201 (Claude Code)\n', stderr: '' });

/**
 * A repo that names no standards keys, so detection gives the root group
 * lightsout/node — a combined pack that holds every rule its rules require.
 */
const setupRepoWithDetectedPack = () => {
	const dir = setupConsumerRepo({ git: false });

	return { dir };
};

test('includes the rule-requirements check', async () => {
	const { dir } = setupRepoWithDetectedPack();

	const checks = await runDoctor({ cwd: dir, probeHarness: passingProbe });

	// the check runs beside the other standards checks, and the detected pack
	// sends every rule it requires, so it reports a pass rather than a warning
	expect(checks.find((check) => check.id === 'rule-requirements')).toEqual(expect.objectContaining({ id: 'rule-requirements', status: 'pass' }));
});
