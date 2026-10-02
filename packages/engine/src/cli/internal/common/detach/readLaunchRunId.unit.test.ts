import { describe, expect, test } from '@jest/globals';
import { readLaunchRunId } from '#src/cli/internal/common/detach/readLaunchRunId.ts';

/** A process environment carrying an unrelated variable, plus the launch variable when one is given. */
const setupEnv = ({ launchRunId }: { launchRunId?: string } = {}) => {
	const env: NodeJS.ProcessEnv = { PATH: '/usr/bin', ...(launchRunId === undefined ? {} : { LIGHTSOUT_RUN_ID: launchRunId }) };

	return { env };
};

describe('readLaunchRunId', () => {
	test('readLaunchRunId: returns the id its parent handed over and removes the variable so nothing it spawns inherits it', () => {
		const { env } = setupEnv({ launchRunId: '3f2b9c1e-7d4a-4e0b-9a51-2c8d6e1f0a77' });

		const runId = readLaunchRunId({ env });

		expect({ runId, stillCarriesVariable: Object.hasOwn(env, 'LIGHTSOUT_RUN_ID'), env }).toStrictEqual({
			runId: '3f2b9c1e-7d4a-4e0b-9a51-2c8d6e1f0a77',
			stillCarriesVariable: false,
			env: { PATH: '/usr/bin' },
		});
	});

	test.each([{ launchRunId: undefined }, { launchRunId: '' }])(
		'readLaunchRunId: a process not launched detached reads no id, and an empty value counts as none',
		({ launchRunId }) => {
			const { env } = setupEnv({ launchRunId });

			const runId = readLaunchRunId({ env });

			expect({ runId, carriesVariable: Object.hasOwn(env, 'LIGHTSOUT_RUN_ID'), env }).toStrictEqual({
				runId: undefined,
				carriesVariable: false,
				env: { PATH: '/usr/bin' },
			});
		},
	);
});
