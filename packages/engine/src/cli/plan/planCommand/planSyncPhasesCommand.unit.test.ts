import { describe, expect, test } from '@jest/globals';
import { parseFlags } from '#src/cli/parseFlags.ts';
import { planSyncPhasesCommand } from '#src/cli/plan/planCommand/planSyncPhasesCommand.ts';
import { syncPlanPhases } from '#src/plan/sections/syncPlanPhases.ts';
import { captureCommandOutput } from '#tests/helpers/captureCommandOutput.ts';
import { overviewBody, phaseBody } from '#tests/helpers/phasePlan.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';
import { writePhasedPlanDeliverable } from '#tests/helpers/writePhasedPlanDeliverable.ts';

// plan sync-phases is deterministic — no agent, no driver — so the arrangement
// is a real consumer repo holding a real phased plan, synced through the same
// runner the CLI calls.
const setupSyncPhases = async ({ rowFiles, inStep = false }: { rowFiles: string[]; inStep?: boolean }) => {
	const captured = captureCommandOutput();
	const cwd = setupConsumerRepo({ git: false });
	const name = 'demo';

	writePhasedPlanDeliverable({
		cwd,
		name,
		files: {
			'overview.md': overviewBody({ rows: rowFiles.map((file, index) => ({ number: index + 1, file })) }),
			'phase1-core.md': phaseBody({ create: ['src/core.ts'] }),
			'phase2-extra.md': phaseBody({ create: ['src/extra.ts'] }),
		},
	});

	// A human repeating the command finds the overview already restated.
	if (inStep) {
		await syncPlanPhases({ cwd, name });
	}

	return { context: { flags: parseFlags({ args: ['--name', name] }), rest: [], cwd }, ...captured };
};

describe('planSyncPhasesCommand', () => {
	test('prints one line for the overview, updated or unchanged, and exits 0', async () => {
		const { logged, errors, exitCodes, context } = await setupSyncPhases({ rowFiles: ['phase1-core.md', 'phase2-extra.md'], inStep: true });

		await expect(planSyncPhasesCommand(context)).rejects.toThrow(/process\.exit/);

		const overviewLines = logged.filter((line) => line.includes('overview.md'));

		expect({
			header: logged[0] ?? '',
			overviewLines,
			errors,
			exitCodes,
		}).toEqual({
			header: expect.stringMatching(/plan sync-phases demo/),
			overviewLines: [expect.stringMatching(/unchanged/i)],
			errors: [],
			exitCodes: [0],
		});
	});

	test('prints the refusal to stderr and exits 1', async () => {
		const { logged, errors, exitCodes, context } = await setupSyncPhases({ rowFiles: ['phase1-core.md'] });

		await expect(planSyncPhasesCommand(context)).rejects.toThrow(/process\.exit/);

		expect({ logged, refusal: errors.join('\n'), exitCodes }).toEqual({
			logged: [],
			refusal: expect.stringMatching(/phase2-extra\.md/),
			exitCodes: [1],
		});
	});
});
