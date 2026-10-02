import { execSync } from 'node:child_process';
import { describe, expect, test } from '@jest/globals';
import { readConfig } from '#src/common/config/readConfig.ts';
import type { RefactorBatch } from '#src/contracts/refactor/RefactorBatch.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import { runBatch } from '#src/refactor/batch/runBatch.ts';
import { runStandardsCheck } from '#src/standardsCheck/runStandardsCheck.ts';
import { report } from '#tests/helpers/report.ts';
import { reviewReport } from '#tests/helpers/reviewReport.ts';
import { roleOf } from '#tests/helpers/roleOf.ts';
import { seedRunFolder } from '#tests/helpers/seedRunFolder.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';
import { writeSource } from '#tests/helpers/writeSource.ts';

/** The lines of a task message's shared-code section that list a folder's files. */
const listedFilesOf = ({ prompt }: { prompt: string | undefined }) => (prompt ?? '').split('\n').filter((line) => line.startsWith('- utils/:'));

/**
 * A repo with two multi-export findings in one folder, so a first pass that
 * clears one is followed by a requeue for the other, and a `common/` folder
 * above them. The first pass extracts a helper into that `common/`; the second
 * never resolves its site. The fixture helper writes a `use…` consumer beside
 * each source, which the listings name too.
 */
const setupBatch = async () => {
	const dir = setupConsumerRepo({
		sources: { 'src/index.js': 'export const one = 1;\n', 'src/common/utils/formatDate.ts': 'export const formatDate = () => 1;\n' },
	});

	seedRunFolder({ cwd: dir, runId: 'run-01', pipeline: 'refactor' });
	writeSource({ dir, path: 'src/one.ts', source: 'export const alphaOne = 1;\nexport const betaOne = 2;\n' });
	writeSource({ dir, path: 'src/two.ts', source: 'export const alphaTwo = 1;\nexport const betaTwo = 2;\n' });
	execSync('git add -A && git -c user.name=t -c user.email=t@t commit -qm fixture', { cwd: dir });

	const config = await readConfig({ cwd: dir });
	const { findings } = await runStandardsCheck({ cwd: dir, config, persist: false });
	const batch: RefactorBatch = {
		id: 'batch-01:lightsout/multi-export:src',
		rule: 'lightsout/multi-export',
		folder: 'src',
		blocking: findings.filter((finding) => finding.rule === 'lightsout/multi-export'),
		advisories: [],
	};
	const executorPrompts: string[] = [];
	const driver: Driver = {
		name: 'stub',
		invoke: async ({ prompt }) => {
			if (roleOf(prompt) === 'standards-review') {
				return { text: reviewReport(), exitCode: 0 };
			}

			executorPrompts.push(prompt);

			if (executorPrompts.length > 1) {
				writeSource({ dir, path: 'src/two.ts', source: 'export const alphaTwo = 1;\nexport const gammaTwo = 3;\n' });

				return { text: report({ changedFiles: [{ path: 'src/two.ts', summary: 'renamed a half' }] }), exitCode: 0 };
			}

			writeSource({ dir, path: 'src/one.ts', source: 'export const alphaOne = 1;\n' });
			writeSource({ dir, path: 'src/common/utils/betaOne.ts', source: 'export const betaOne = 2;\n' });

			return {
				text: report({
					changedFiles: [
						{ path: 'src/one.ts', summary: 'split' },
						{ path: 'src/common/utils/betaOne.ts', summary: 'extracted' },
					],
				}),
				exitCode: 0,
			};
		},
	};

	const run = () =>
		runBatch({
			cwd: dir,
			runId: 'run-01',
			driver,
			config,
			batch,
			groups: [],
			checkAll: false,
			agentReview: true,
			agentTimeoutMs: 60_000,
			attributedFiles: [],
			onProgress: () => undefined,
			recordUsage: async () => undefined,
		});

	return { run, executorPrompts };
};

describe('runBatch', () => {
	test('each pass is shown the shared code within reach of its findings, read from the tree as the pass before left it', async () => {
		const { run, executorPrompts } = await setupBatch();

		await run();

		// the requeue sees the helper the first pass extracted, so it has no reason to write it again
		expect(executorPrompts.map((prompt) => listedFilesOf({ prompt }))).toStrictEqual([
			['- utils/: formatDate, useFormatDate'],
			['- utils/: betaOne, formatDate, useBetaOne, useFormatDate'],
		]);
	});
});
