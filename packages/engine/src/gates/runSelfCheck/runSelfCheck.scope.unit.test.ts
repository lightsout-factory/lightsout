import { describe, expect, test } from '@jest/globals';
import { runSelfCheck } from '#src/gates/runSelfCheck/runSelfCheck.ts';
import { setupSelfCheck } from '#tests/helpers/setupSelfCheck.ts';

describe('runSelfCheck', () => {
	test('runSelfCheck: ends on an unchanged tree and on an unreadable git status without widening to the whole repository', async () => {
		const unchanged = await setupSelfCheck({ changed: [] });
		const unreadable = await setupSelfCheck({ git: false });

		const onUnchangedTree = await runSelfCheck({
			cwd: unchanged.dir,
			config: unchanged.config,
			coverage: false,
			checkpoint: 'verify-implement',
			wholeRepository: false,
			runId: 'run-1',
			step: 'implement',
			onProgress: () => undefined,
		});
		const onUnreadableStatus = await runSelfCheck({
			cwd: unreadable.dir,
			config: unreadable.config,
			coverage: false,
			checkpoint: 'verify-implement',
			wholeRepository: false,
			runId: 'run-1',
			step: 'implement',
			onProgress: () => undefined,
		});

		// nothing to check and could-not-work-out-what-to-check are different
		// answers: one is the tree being clean, the other is the engine failing
		expect([onUnchangedTree.reason, onUnreadableStatus.reason]).toStrictEqual(['nothing-changed', 'unavailable']);
		// neither widens: the whole repository's suite inside the agent's own
		// timeout is the cost a scoped self-check exists to avoid
		expect([unchanged.log(), unreadable.log()]).toStrictEqual([[], []]);
	});

	test("runSelfCheck: runs the root gate set over the whole tree with coverage on, the way the direct pipeline's own pass does", async () => {
		const { dir, config, log } = await setupSelfCheck();

		const result = await runSelfCheck({
			cwd: dir,
			config,
			coverage: true,
			wholeRepository: true,
			runId: 'run-1',
			step: 'implement',
			onProgress: () => undefined,
		});

		// that pipeline names no checkpoint and reads no diff, so neither does its
		// self-check: the root block over the whole tree, coverage included, and the
		// scoped block left unused even though this repo configures one. The plain
		// unit suite is absent because the instrumented one is the same tests again.
		expect(result.reason).toBe('ran');
		expect(result.gateNames).toStrictEqual(['check', 'test-coverage', 'build']);
		expect(log()).toStrictEqual(['root check', 'root coverage', 'root build']);
	});

	test('runSelfCheck: runs the root gates for a change outside the packages dir, rather than the package groups', async () => {
		const { dir, config, log } = await setupSelfCheck({ changed: ['README.md'] });

		const result = await runSelfCheck({
			cwd: dir,
			config,
			coverage: false,
			checkpoint: 'verify-implement',
			wholeRepository: false,
			runId: 'run-1',
			step: 'implement',
			onProgress: () => undefined,
		});

		// a file belonging to no package is whole-repository precedence, exactly as
		// the checkpoint that follows resolves it
		expect(result.reason).toBe('ran');
		expect(log()).toStrictEqual(['root check', 'root test', 'root build']);
	});
});
