import { describe, expect, test } from '@jest/globals';
import { WorkReport } from '#src/contracts/work/WorkReport.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import type { DriverInvocation } from '#src/drivers/common/types/DriverInvocation.ts';
import { invokeAgentWithContract } from '#src/invoke/invokeAgentWithContract.ts';
import { report } from '#tests/helpers/report.ts';

const roleInvocation = { systemPrompt: 'ROLE-SYSTEM-PROMPT', prompt: 'ROLE-PROMPT' };

/**
 * A final message that IS valid JSON but not a valid WorkReport — `summary`
 * must be a string. There is an object to reconstruct from, so the rejection
 * earns the cheap re-emit rung this file is about.
 */
const objectBearingRejection = report({ summary: 42 });

/**
 * A driver that fails the contract once and then answers it, recording the
 * writable directories and the prompt of every rung it was handed. A re-emit
 * rung is told apart by its prompt: it is the one carrying `# Validation error`.
 */
const setupWritableDirsRelay = () => {
	const writableDirs: (string[] | undefined)[] = [];
	const prompts: string[] = [];

	const driver: Driver = {
		name: 'stub',
		invoke: async (invocation: DriverInvocation) => {
			prompts.push(invocation.prompt);
			writableDirs.push(invocation.writableDirs);

			return prompts.length === 1 ? { text: objectBearingRejection, exitCode: 0 } : { text: report({ summary: 'answered on the re-emit rung' }), exitCode: 0 };
		},
	};

	const isReemit = (prompt: string) => prompt.includes('# Validation error');

	return { driver, writableDirs, prompts, isReemit };
};

describe('invokeAgentWithContract: the writable directories', () => {
	test('relays the writable directories unchanged to the role rung and the re-emit rung', async () => {
		const { driver, writableDirs, prompts, isReemit } = setupWritableDirsRelay();

		const outcome = await invokeAgentWithContract({
			driver,
			cwd: '/repo-worktrees/lo-7-search',
			invocation: roleInvocation,
			contract: WorkReport,
			writableDirs: ['/repo/.lightsout/work-orders/lo-7-search/plans/002-search-basics', '/repo/.lightsout/shared'],
		});

		expect(outcome).toEqual(expect.objectContaining({ ok: true, report: expect.objectContaining({ summary: 'answered on the re-emit rung' }) }));
		// the role rung, then its cheap re-emit
		expect(prompts.map(isReemit)).toStrictEqual([false, true]);
		// a re-emit spawned without the grant could not write the plan folder the
		// role rung was allowed to write
		expect(writableDirs).toStrictEqual([
			['/repo/.lightsout/work-orders/lo-7-search/plans/002-search-basics', '/repo/.lightsout/shared'],
			['/repo/.lightsout/work-orders/lo-7-search/plans/002-search-basics', '/repo/.lightsout/shared'],
		]);
	});
});
