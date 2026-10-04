import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@jest/globals';
import { readConfig } from '#src/common/config/readConfig.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import { runImplementPipeline } from '#src/pipeline/runImplementPipeline/runImplementPipeline.ts';
import { summarizeRun } from '#src/runState/summarizeRun/summarizeRun.ts';
import { report } from '#tests/helpers/report.ts';
import { reviewOneAdvisory } from '#tests/helpers/reviewOneAdvisory.ts';
import { roleOf } from '#tests/helpers/roleOf.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';
import { withTestChangeReview } from '#tests/helpers/withTestChangeReview.ts';
import { writeSource } from '#tests/helpers/writeSource.ts';

const usage = {
	inputTokens: 10,
	outputTokens: 100,
	cacheReadTokens: 880,
	cacheCreationTokens: 110,
	costUsd: 0.5,
};

/** Drive a whole implement run with a stub driver, so the summary reads evidence the pipeline itself wrote. */
const setupPipelineRun = async () => {
	const cwd = setupConsumerRepo();
	const driver: Driver = {
		name: 'stub',
		invoke: withTestChangeReview({
			invoke: async ({ prompt, systemPrompt }) => {
				const role = roleOf(prompt);

				if (role === 'standards-review') {
					// One advisory, so the bounded cleanup loop has something to hand its
					// first round: this fixture's tree carries no qualifying deterministic
					// finding, and cleanup no longer spends a round on nothing.
					return { text: reviewOneAdvisory({ systemPrompt, path: 'src/feature.js' }), exitCode: 0 };
				}

				if (role === 'write-tests') {
					writeFileSync(join(cwd, 'test.feature.test.js'), '// stub\n');

					return { text: report({ changedFiles: [{ path: 'test.feature.test.js', summary: 'tests' }] }), exitCode: 0, usage };
				}

				if (role === 'refactor') {
					return {
						text: report({ friction: [{ kind: 'decision', area: 'plan', detail: 'guessed a boundary' }] }),
						exitCode: 0,
						usage,
					};
				}

				writeSource({ dir: cwd, path: 'src/feature.js', source: 'export const feature = () => 2;\n' });

				return { text: report({ changedFiles: [{ path: 'src/feature.js', summary: 'feature' }] }), exitCode: 0, usage };
			},
		}),
	};

	const config = await readConfig({ cwd });
	const result = await runImplementPipeline({ cwd, planPath: 'plan.md', driver, config, loadedConfig: { config } });

	return { cwd, result };
};

test('summarizeRun aggregates step durations, per-step usage, files, gates, and friction', async () => {
	const { cwd, result } = await setupPipelineRun();

	expect(result.ok).toBe(true);

	const summary = await summarizeRun({ cwd, manifest: result.manifest });

	expect(summary.wallMs >= 0).toBeTruthy();
	// active time summed from step durations
	expect(summary.activeMs > 0).toBeTruthy();
	// gate time measured from commands.jsonl
	expect(summary.gateMs > 0).toBeTruthy();
	expect(summary.gates.commands > 0).toBeTruthy();

	const byId = new Map(summary.steps.map((step) => [step.id, step]));
	const implement = byId.get('implement');
	const writeTests = byId.get('write-tests');
	const refactor = byId.get('refactor');
	const cleanSlate = byId.get('clean-slate');

	// implement duration stamped
	expect(typeof implement?.durationMs).toBe('number');
	expect(implement?.changedFiles).toStrictEqual(['src/feature.js']);
	expect(implement?.invocations).toBe(1);
	expect(implement?.outputTokens).toBe(100);
	expect(implement?.costUsd).toBe(0.5);

	expect(writeTests?.changedFiles).toStrictEqual(['test.feature.test.js']);
	// one writer per changed file: the module and the caller wiring it in
	expect(writeTests?.invocations).toBe(2);

	// The refactor loop reported zero changes on its first pass — attributed
	// as an explicit empty list, distinct from steps that never change files.
	expect(refactor?.changedFiles).toStrictEqual([]);
	expect(refactor?.invocations).toBe(1);

	// gate-only steps bill no agents
	expect(cleanSlate?.invocations).toBe(0);
	expect(cleanSlate?.changedFiles).toBe(undefined);

	expect(summary.cacheReadShare).toBe(0.88);
	expect(summary.rejectedReports).toBe(0);
	expect(summary.frictionByArea).toStrictEqual([{ area: 'plan', count: 1 }]);
	expect(summary.verificationRepairs).toStrictEqual([]);
});
