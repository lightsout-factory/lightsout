import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { readConfig } from '#src/common/config/readConfig.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import { runImplementPipeline } from '#src/pipeline/runImplementPipeline.ts';
import { report } from '#tests/helpers/report.ts';
import { reviewReport } from '#tests/helpers/reviewReport.ts';
import { roleOf } from '#tests/helpers/roleOf.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';
import { verdict } from '#tests/helpers/verdict.ts';
import { withTestChangeReview } from '#tests/helpers/withTestChangeReview.ts';
import { writeSource } from '#tests/helpers/writeSource.ts';

/** A plan that names the one file it creates, which is where the implementing agent is about to work. */
const billingPlan = '# Plan: add the invoice total\n\n## Files to Create\n\n### `src/billing/getTotal.js`\n';

/**
 * Shared code at the top, in the feature the plan works in, and in a feature it
 * never touches. The fixture helper writes a `use…` consumer beside each source,
 * so every listing below names those too.
 */
const sources = {
	'src/index.js': 'export const one = 1;\n',
	'src/common/utils/formatDate.js': 'export const formatDate = () => "today";\n',
	'src/billing/common/utils/formatMoney.js': 'export const formatMoney = () => "$1";\n',
	'src/shipping/common/utils/formatAddress.js': 'export const formatAddress = () => "here";\n',
};

/** The shared-code section of a task message, or nothing when the message carries none. */
const sharedCodeOf = ({ prompt }: { prompt: string | undefined }) =>
	/# Shared code within reach\n\n[^\n]+\n\n([\s\S]*?)\n\n(?:#|Remember)/.exec(prompt ?? '')?.[1];

interface SetupParams {
	plan?: string;
	/** Make the unit gate refuse the moment implement lands, so verify-implement buys a fix re-invocation. */
	redGate?: boolean;
	/** Keep the repo's standards on and have the implementer break one, which is what makes the refactor step spawn its agent. */
	standardsDefect?: boolean;
}

/**
 * A consumer repo whose stub driver records the first task message each role
 * was invoked with. Its implementer adds a helper to the feature's own
 * `common/`, which a later spawn should then be shown. Standards are off unless
 * a test asks for a defect, so nothing but the listing under test tells an
 * agent about shared code.
 */
const setupSharedCodeRun = async ({ plan = billingPlan, redGate, standardsDefect }: SetupParams = {}) => {
	const dir = setupConsumerRepo({
		plan,
		sources,
		config: standardsDefect ? undefined : { 'standards-pack': false },
		scripts: redGate ? { test: 'test ! -f BROKEN' } : undefined,
	});
	// Two exports in one file is a blocking finding under the fixture's strict profile.
	const totalSource = standardsDefect ? 'export const getTotal = () => 2;\nexport const getTax = () => 1;\n' : 'export const getTotal = () => 2;\n';
	const prompts: Record<string, string | undefined> = {};

	const driver: Driver = {
		name: 'stub',
		invoke: withTestChangeReview({
			invoke: async ({ prompt }) => {
				const role = roleOf(prompt);

				if (role === 'standards-review') {
					return { text: reviewReport(), exitCode: 0 };
				}

				prompts[role] ??= prompt;

				if (role === 'supervisor') {
					return { text: verdict(), exitCode: 0 };
				}

				if (role === 'write-tests') {
					mkdirSync(join(dir, 'test'), { recursive: true });
					writeFileSync(join(dir, 'test/getTotal.test.js'), '// stub\n');

					return { text: report({ changedFiles: [{ path: 'test/getTotal.test.js', summary: 'tests' }] }), exitCode: 0 };
				}

				if (role === 'refactor' || role === 'fix') {
					return { text: report(), exitCode: 0 };
				}

				writeSource({ dir, path: 'src/billing/getTotal.js', source: totalSource });
				writeSource({ dir, path: 'src/billing/common/utils/sumLines.js', source: 'export const sumLines = () => 2;\n' });

				if (redGate) {
					writeFileSync(join(dir, 'BROKEN'), 'x');
				}

				return {
					text: report({
						changedFiles: [
							{ path: 'src/billing/getTotal.js', summary: 'the total' },
							{ path: 'src/billing/common/utils/sumLines.js', summary: 'a shared helper' },
						],
					}),
					exitCode: 0,
				};
			},
		}),
	};

	return { dir, driver, prompts, config: await readConfig({ cwd: dir }) };
};

describe('runImplementPipeline', () => {
	test('the implementing agent is shown the shared code on the way up from the files its plan names, and no other feature’s', async () => {
		const { dir, driver, prompts, config } = await setupSharedCodeRun();

		await runImplementPipeline({ cwd: dir, planPath: 'plan.md', driver, config, loadedConfig: { config } });

		expect(sharedCodeOf({ prompt: prompts.implement })).toBe(
			['`src/billing/common/`', '- utils/: formatMoney, useFormatMoney', '', '`src/common/`', '- utils/: formatDate, useFormatDate'].join('\n'),
		);
	});

	test('the refactoring agent is shown the tree as the implementer left it, shared code the run added included', async () => {
		const { dir, driver, prompts, config } = await setupSharedCodeRun({ standardsDefect: true });

		await runImplementPipeline({ cwd: dir, planPath: 'plan.md', driver, config, loadedConfig: { config } });

		expect(sharedCodeOf({ prompt: prompts.refactor })).toBe(
			[
				'`src/billing/common/`',
				'- utils/: formatMoney, sumLines, useFormatMoney, useSumLines',
				'',
				'`src/common/`',
				'- utils/: formatDate, useFormatDate',
			].join('\n'),
		);
	});

	test('a fix re-invocation is shown it again, read afresh rather than remembered from the first spawn', async () => {
		const { dir, driver, prompts, config } = await setupSharedCodeRun({ redGate: true });

		await runImplementPipeline({ cwd: dir, planPath: 'plan.md', driver, config, loadedConfig: { config } });

		expect(sharedCodeOf({ prompt: prompts.fix })).toContain('- utils/: formatMoney, sumLines, useFormatMoney, useSumLines');
	});

	test('a plan that names no files gives the implementing agent nowhere to look from, and no listing', async () => {
		const { dir, driver, prompts, config } = await setupSharedCodeRun({ plan: '# Plan: add feature\n' });

		await runImplementPipeline({ cwd: dir, planPath: 'plan.md', driver, config, loadedConfig: { config } });

		expect(prompts.implement).not.toContain('# Shared code within reach');
	});
});
