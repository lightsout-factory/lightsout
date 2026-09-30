import { execSync } from 'node:child_process';
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { readConfig } from '#src/common/config/readConfig.ts';
import type { RefactorBatch } from '#src/contracts/refactor/RefactorBatch.ts';
import { StandardsPackSource } from '#src/contracts/standards/StandardsPackSource.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import { runBatch } from '#src/refactor/batch/runBatch.ts';
import { readReviewFindings } from '#src/runState/readReviewFindings.ts';
import type { StandardsGroup } from '#src/standards/common/types/StandardsGroup.ts';
import type { ResolvedRuleState } from '#src/standardsCheck/common/types/ResolvedRuleState.ts';
import { runStandardsCheck } from '#src/standardsCheck/runStandardsCheck.ts';
import type { LoadedStandardsRule } from '#src/standardsLibraries/common/types/LoadedStandardsRule.ts';
import { report } from '#tests/helpers/report.ts';
import { reviewReport } from '#tests/helpers/reviewReport.ts';
import { roleOf } from '#tests/helpers/roleOf.ts';
import { seedRunFolder } from '#tests/helpers/seedRunFolder.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';
import { verdict } from '#tests/helpers/verdict.ts';
import { writeSource } from '#tests/helpers/writeSource.ts';

const singleReturn: LoadedStandardsRule = {
	id: 'single-return',
	name: 'acme/single-return',
	library: 'acme',
	set: 'code',
	documentPath: 'code/style-guide/patterns/single-return',
	summary: 'more than one exit from a function',
	prose: 'the argument for the rule',
	channel: 'base',
	checked: false,
	defaultSeverity: StandardsSeverity.Advisory,
	defaultOptions: {},
	fixturesPath: '/packages/acme/single-return/fixtures',
};

/**
 * One judgment-only rule in one group — the run's groups, which runBatch owns the
 * threading of: they reach the pre-edit read through collectBatchAdvisories and
 * the read of what the batch wrote through the tools it builds.
 */
const judgmentGroups: StandardsGroup[] = [
	{
		packages: [''],
		pack: { name: 'acme/house', topics: [], rules: [{ rule: singleReturn, severity: singleReturn.defaultSeverity, options: singleReturn.defaultOptions }] },
		source: StandardsPackSource.Named,
		states: new Map<string, ResolvedRuleState>([
			[singleReturn.name, { severity: singleReturn.defaultSeverity, options: singleReturn.defaultOptions, fromConfig: false, reachesAgents: true }],
		]),
	},
];

/** Split a multi-export file in two, each half with the caller that uses it — an unreferenced half is its own blocking finding. */
const splitFile = ({ dir, file, first, second }: { dir: string; file: string; first: string; second: string }) => {
	writeSource({ dir, path: file, source: `export const ${first} = 1;\n` });
	writeSource({ dir, path: file.replace(/[^/]+\.ts$/, `${second}.ts`), source: `export const ${second} = 2;\n` });
};

/**
 * A repo with two multi-export findings in ONE folder — a single batch of two
 * sites, the arrangement a partial pass and its requeue need — and the batch
 * object a run would freeze for it, built from a live check so the site keys
 * are the ones the re-check will answer with rather than ones a test invented.
 *
 * `answer` is the executor's reply for each pass in turn: it edits the tree and
 * returns the report it claims for that edit, which is the whole of what the
 * batch loop reads.
 */
const setupBatch = async ({ answer, groups = [] }: { answer: (params: { pass: number; dir: string }) => string; groups?: StandardsGroup[] }) => {
	const dir = setupConsumerRepo();

	// The run below already has its folder, because `createRun` makes one before
	// a run starts and the batch's evidence looks the run up by id.
	seedRunFolder({ cwd: dir, runId: 'run-01', pipeline: 'refactor' });

	writeSource({ dir, path: 'src/one.ts', source: 'export const alphaOne = 1;\nexport const betaOne = 2;\n' });
	writeSource({ dir, path: 'src/two.ts', source: 'export const alphaTwo = 1;\nexport const betaTwo = 2;\n' });
	execSync('git add -A && git -c user.name=t -c user.email=t@t commit -qm fixture', { cwd: dir });

	const { findings } = await runStandardsCheck({ cwd: dir, persist: false });
	const batch: RefactorBatch = {
		id: 'batch-01:lightsout/multi-export:src',
		rule: 'lightsout/multi-export',
		folder: 'src',
		blocking: findings.filter((finding) => finding.rule === 'lightsout/multi-export'),
		advisories: [],
	};
	const executorPrompts: string[] = [];
	const reviewSystemPrompts: string[] = [];
	const config = await readConfig({ cwd: dir });
	const driver: Driver = {
		name: 'stub',
		invoke: async ({ prompt, systemPrompt }) => {
			if (roleOf(prompt) === 'standards-review') {
				reviewSystemPrompts.push(systemPrompt ?? '');

				return { text: reviewReport(), exitCode: 0 };
			}

			executorPrompts.push(prompt);

			return { text: answer({ pass: executorPrompts.length, dir }), exitCode: 0 };
		},
	};

	const run = () =>
		runBatch({
			cwd: dir,
			runId: 'run-01',
			driver,
			config,
			batch,
			groups,
			checkAll: false,
			agentReview: true,
			agentTimeoutMs: 60_000,
			attributedFiles: [],
			onProgress: () => undefined,
			recordUsage: async () => undefined,
		});

	return { run, executorPrompts, reviewSystemPrompts };
};

/**
 * One site in a repo whose test gate is red for exactly as long as a `BROKEN`
 * marker sits at its root, and an executor whose pass clears the site and leaves
 * that marker behind.
 *
 * The batch therefore arrives at its gates with the work done and the tree red,
 * which is the only way into the verify path the batch owns: a fixed number of
 * cheap fix attempts, and then — because these ones never remove the marker —
 * the supervisor. `ruling` is what the supervisor answers and `healOnGuidance`
 * says whether the guided fix removes the marker, so the two together choose
 * which ending the batch reaches.
 *
 * The gates are the real ones: the point of the arrangement is what the batch
 * does with a verdict it did not invent.
 */
const setupRedGateBatch = async ({ ruling, healOnGuidance = false }: { ruling: Record<string, unknown>; healOnGuidance?: boolean }) => {
	const dir = setupConsumerRepo({ scripts: { test: 'test ! -f BROKEN' } });

	seedRunFolder({ cwd: dir, runId: 'run-01', pipeline: 'refactor' });

	writeSource({ dir, path: 'src/one.ts', source: 'export const alphaOne = 1;\nexport const betaOne = 2;\n' });
	execSync('git add -A && git -c user.name=t -c user.email=t@t commit -qm fixture', { cwd: dir });

	const { findings } = await runStandardsCheck({ cwd: dir, persist: false });
	const batch: RefactorBatch = {
		id: 'batch-01:lightsout/multi-export:src',
		rule: 'lightsout/multi-export',
		folder: 'src',
		blocking: findings.filter((finding) => finding.rule === 'lightsout/multi-export'),
		advisories: [],
	};
	// Every agent the batch spends, in the order it spent them — which is what
	// says whether a budget was kept and whether an ending was bought.
	const spent: string[] = [];
	const config = await readConfig({ cwd: dir });
	const driver: Driver = {
		name: 'stub',
		invoke: async ({ prompt }) => {
			const role = roleOf(prompt);

			if (role === 'standards-review') {
				return { text: reviewReport(), exitCode: 0 };
			}

			if (role === 'supervisor') {
				spent.push('supervisor');

				return { text: verdict(ruling), exitCode: 0 };
			}

			// A gate fix wears the executor's role and carries the red that sent the
			// work back, which is what tells the two apart here.
			if (prompt.includes('# Verification failure')) {
				spent.push('fix');

				if (healOnGuidance && prompt.includes('Supervisor guidance')) {
					unlinkSync(join(dir, 'BROKEN'));
				}

				return { text: report(), exitCode: 0 };
			}

			spent.push('executor');
			splitFile({ dir, file: 'src/one.ts', first: 'alphaOne', second: 'betaOne' });
			writeFileSync(join(dir, 'BROKEN'), 'x');

			return { text: report({ changedFiles: [{ path: 'src/one.ts', summary: 'split' }] }), exitCode: 0 };
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

	return { run, spent };
};

/**
 * The two-site batch in a repo whose packages live under `apps/`, with one
 * workspace package `web`, and a group that covers only `web` and holds the
 * judgment rule.
 *
 * On every read the reviewer reports that rule against a `web` file. The file
 * belongs to the `web` group only when the review places it with `apps` as the
 * packages dir; under any other dir it is a root file no group covers, and the
 * review drops it. So a record in the judgment ledger for each read is the proof
 * that each review had the config's packages-dir.
 */
const setupAppsBatch = async () => {
	const dir = setupConsumerRepo({ config: { 'packages-dir': 'apps' } });

	seedRunFolder({ cwd: dir, runId: 'run-01', pipeline: 'refactor' });

	mkdirSync(join(dir, 'apps', 'web'), { recursive: true });
	writeFileSync(join(dir, 'apps', 'web', 'package.json'), '{ "name": "web" }\n');
	writeSource({ dir, path: 'src/one.ts', source: 'export const alphaOne = 1;\nexport const betaOne = 2;\n' });
	writeSource({ dir, path: 'src/two.ts', source: 'export const alphaTwo = 1;\nexport const betaTwo = 2;\n' });
	execSync('git add -A && git -c user.name=t -c user.email=t@t commit -qm fixture', { cwd: dir });

	const { findings } = await runStandardsCheck({ cwd: dir, persist: false });
	const batch: RefactorBatch = {
		id: 'batch-01:lightsout/multi-export:src',
		rule: 'lightsout/multi-export',
		folder: 'src',
		blocking: findings.filter((finding) => finding.rule === 'lightsout/multi-export'),
		advisories: [],
	};
	const webGroups: StandardsGroup[] = judgmentGroups.map((group) => ({ ...group, packages: ['web'] }));
	const config = await readConfig({ cwd: dir });
	const driver: Driver = {
		name: 'stub',
		invoke: async ({ prompt }) => {
			if (roleOf(prompt) === 'standards-review') {
				return { text: reviewReport([{ rule: 'acme/single-return', files: [{ path: 'apps/web/src/a.ts' }], detail: 'two exits' }]), exitCode: 0 };
			}

			splitFile({ dir, file: 'src/one.ts', first: 'alphaOne', second: 'betaOne' });
			splitFile({ dir, file: 'src/two.ts', first: 'alphaTwo', second: 'betaTwo' });

			return {
				text: report({ changedFiles: ['src/one.ts', 'src/betaOne.ts', 'src/two.ts', 'src/betaTwo.ts'].map((path) => ({ path, summary: 'split' })) }),
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
			groups: webGroups,
			checkAll: false,
			agentReview: true,
			agentTimeoutMs: 60_000,
			attributedFiles: [],
			onProgress: () => undefined,
			recordUsage: async () => undefined,
		});

	return { dir, batch, run };
};

describe('runBatch', () => {
	test('a requeue that changes the tree and still leaves a site standing spends the budget and declines', async () => {
		const { run, executorPrompts } = await setupBatch({
			answer: ({ pass, dir }) => {
				if (pass === 1) {
					splitFile({ dir, file: 'src/one.ts', first: 'alphaOne', second: 'betaOne' });

					return report({ changedFiles: [{ path: 'src/one.ts', summary: 'split' }] });
				}

				// The requeue writes — so this is not the changed-nothing decline the
				// pass itself settles — but it never resolves the site it was handed,
				// which leaves the loop's own budget ceiling as the only way out.
				writeSource({ dir, path: 'src/two.ts', source: 'export const alphaTwo = 1;\nexport const gammaTwo = 3;\n' });

				return report({ changedFiles: [{ path: 'src/two.ts', summary: 'renamed a half' }] });
			},
		});

		const stop = await run();

		expect(stop.kind === 'done' && stop.report).toStrictEqual({ outcome: 'declined', remainingSiteKeys: ['lightsout/multi-export:src/two.ts'], rationale: [] });
		// two passes, never a third — the ceiling is the loop's, not the pass's
		expect(executorPrompts.length).toBe(2);
	});

	test('a pass that clears every site resolves the batch with nothing left standing', async () => {
		const { run } = await setupBatch({
			answer: ({ dir }) => {
				splitFile({ dir, file: 'src/one.ts', first: 'alphaOne', second: 'betaOne' });
				splitFile({ dir, file: 'src/two.ts', first: 'alphaTwo', second: 'betaTwo' });

				return report({ changedFiles: ['src/one.ts', 'src/betaOne.ts', 'src/two.ts', 'src/betaTwo.ts'].map((path) => ({ path, summary: 'split' })) });
			},
		});

		const stop = await run();

		expect(stop.kind === 'done' && stop.report).toStrictEqual({ outcome: 'resolved', remainingSiteKeys: [], rationale: [] });
	});

	test('the run’s packs reach both the pre-edit read and the read of what the batch wrote', async () => {
		const { run, reviewSystemPrompts } = await setupBatch({
			groups: judgmentGroups,
			answer: ({ dir }) => {
				splitFile({ dir, file: 'src/one.ts', first: 'alphaOne', second: 'betaOne' });
				splitFile({ dir, file: 'src/two.ts', first: 'alphaTwo', second: 'betaTwo' });

				return report({ changedFiles: ['src/one.ts', 'src/betaOne.ts', 'src/two.ts', 'src/betaTwo.ts'].map((path) => ({ path, summary: 'split' })) });
			},
		});

		await run();

		// the same judgment rules on both sides of the edits — a batch reviewed
		// against a different set afterwards could report its own baseline as new
		expect(reviewSystemPrompts.map((systemPrompt) => systemPrompt.includes('Rule: `acme/single-return`'))).toStrictEqual([true, true]);
	});

	test("passes the config's packages-dir to both batch reviews", async () => {
		const { dir, batch, run } = await setupAppsBatch();

		await run();
		const records = await readReviewFindings({ cwd: dir });

		// one record from the pre-edit read and one from the read of what the batch
		// wrote — each review kept the web file's finding only because it had `apps`
		expect(records.filter((record) => record.step === batch.id).map((record) => record.siteKey)).toStrictEqual([
			'acme/single-return:apps/web/src/a.ts',
			'acme/single-return:apps/web/src/a.ts',
		]);
	});

	test('a red gate the cheap fixes cannot clear reaches the supervisor, and an escalate ruling ends the batch', async () => {
		const { run, spent } = await setupRedGateBatch({ ruling: { decision: 'escalate', diagnosis: 'DIAGNOSIS-SENTINEL' } });

		const stop = await run();

		// two mechanical attempts and one supervisor consult — an escalate ruling
		// buys no guided retry, so the batch ends on the supervisor's word
		expect(spent).toStrictEqual(['executor', 'fix', 'fix', 'supervisor']);
		expect(stop).toEqual({ kind: 'escalated', error: expect.stringContaining('DIAGNOSIS-SENTINEL') });
	});

	test('a supervisor’s guided retry that clears the red lets the batch finish resolved', async () => {
		const { run, spent } = await setupRedGateBatch({
			ruling: { decision: 'retry', diagnosis: 'a marker file the pass left behind', guidance: 'delete BROKEN' },
			healOnGuidance: true,
		});

		const stop = await run();

		// the guided retry is the last agent the batch spends: the re-run after it
		// is green, so the batch is classified on its sites rather than escalated
		expect(spent).toStrictEqual(['executor', 'fix', 'fix', 'supervisor', 'fix']);
		expect(stop.kind === 'done' && stop.report).toEqual(expect.objectContaining({ outcome: 'resolved', remainingSiteKeys: [] }));
	});
});
