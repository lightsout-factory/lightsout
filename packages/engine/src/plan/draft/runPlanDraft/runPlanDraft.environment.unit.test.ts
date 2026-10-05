import { describe, expect, test } from '@jest/globals';
import type { Driver } from '#src/common/types/Driver.ts';
import type { DriverInvocation } from '#src/common/types/DriverInvocation.ts';
import { runPlanDraft } from '#src/plan/draft/runPlanDraft/runPlanDraft.ts';
import { cleanPlanBody } from '#tests/helpers/cleanPlanBody.ts';
import { createDraftDriver } from '#tests/helpers/createDraftDriver.ts';
import { expectStatus } from '#tests/helpers/expectStatus.ts';
import { seedPlanWorkspace } from '#tests/helpers/seedPlanWorkspace.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';

/**
 * A seeded repo whose driver answers to the given harness name and records every
 * invocation, so a case reads what environment the writer asked for.
 */
const setupDraft = ({ harness }: { harness: string }) => {
	const cwd = setupConsumerRepo();

	seedPlanWorkspace({ cwd, name: 'environment' });

	const invocations: DriverInvocation[] = [];
	const driver: Driver = {
		...createDraftDriver({ bodies: [cleanPlanBody()], onInvoke: (invocation) => invocations.push(invocation) }),
		name: harness,
	};

	return { cwd, driver, invocations };
};

describe('runPlanDraft', () => {
	test('asks the harness for the restricted drafting environment', async () => {
		const { cwd, driver, invocations } = setupDraft({ harness: 'claude-code' });

		const result = await runPlanDraft({ cwd, driver, name: 'environment' });

		expectStatus(result, 'complete');
		expect(invocations[0]?.environment).toEqual(
			expect.objectContaining({ noMcpServers: true, noSkillCatalog: true, toolAllowlist: true, settingsPreserved: true }),
		);
	});

	test.each(['codex', 'pi', 'omp'])('drafts on %s, which cannot apply every control, rather than refusing', async (harness) => {
		const { cwd, driver } = setupDraft({ harness });

		const result = await runPlanDraft({ cwd, driver, name: 'environment' });

		// the controls only save tokens, so a harness that lacks some still drafts
		expectStatus(result, 'complete');
	});
});
