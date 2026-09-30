import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import type { RefactorBatch } from '#src/contracts/refactor/RefactorBatch.ts';
import { StandardsPackSource } from '#src/contracts/standards/StandardsPackSource.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import { collectBatchAdvisories } from '#src/refactor/batch/collectBatchAdvisories.ts';
import type { StandardsGroup } from '#src/standards/common/types/StandardsGroup.ts';
import type { ResolvedRuleState } from '#src/standardsCheck/common/types/ResolvedRuleState.ts';
import type { LoadedStandardsRule } from '#src/standardsLibraries/common/types/LoadedStandardsRule.ts';
import { freshCwd } from '#tests/helpers/freshCwd.ts';

const finding = (overrides: Partial<StandardsFinding> = {}): StandardsFinding => ({
	rule: 'function-size',
	severity: StandardsSeverity.Advisory,
	siteKey: 'function-size:src/a.ts',
	files: [{ path: 'src/a.ts' }],
	detail: '81 lines',
	...overrides,
});

const batch = ({ paths }: { paths: string[] }): RefactorBatch => ({
	id: 'batch-01:multi-export:src',
	rule: 'multi-export',
	folder: 'src',
	blocking: paths.map((path) => finding({ rule: 'multi-export', severity: StandardsSeverity.Blocking, siteKey: `multi-export:${path}`, files: [{ path }] })),
	advisories: [],
});

const judgmentRule: LoadedStandardsRule = {
	id: 'path-aliases',
	name: 'acme/path-aliases',
	library: 'acme',
	set: 'code',
	documentPath: 'code/style-guide/structure/import-paths',
	summary: 'a relative import in an aliased package',
	prose: 'the argument for the rule',
	channel: 'base',
	checked: false,
	defaultSeverity: StandardsSeverity.Advisory,
	defaultOptions: {},
	requires: [],
	fixturesPath: '/packages/acme/path-aliases/fixtures',
};

const groupOf = ({ rules }: { rules: LoadedStandardsRule[] }): StandardsGroup => ({
	packages: [''],
	pack: { name: 'acme/house', topics: [], rules: rules.map((rule) => ({ rule, severity: rule.defaultSeverity, options: rule.defaultOptions })) },
	source: StandardsPackSource.Named,
	states: new Map<string, ResolvedRuleState>(
		rules.map((rule) => [rule.name, { severity: rule.defaultSeverity, options: rule.defaultOptions, fromConfig: false, reachesAgents: true }]),
	),
});

const setupDriver = ({ text }: { text: string }) => {
	const driver: Driver = { name: 'stub', invoke: async () => ({ text, exitCode: 0 }) };
	const progress: string[] = [];

	return { driver, progress, onProgress: (message: string) => progress.push(message) };
};

/** A workspace whose packages live under `apps/`, so only a forwarded packages dir finds them. */
const setupAppsWorkspace = async () => {
	const cwd = await freshCwd();
	await mkdir(join(cwd, 'apps', 'web-app'), { recursive: true });
	await writeFile(join(cwd, 'apps', 'web-app', 'package.json'), '{}');
	const { driver, onProgress } = setupDriver({
		text: JSON.stringify({ findings: [{ rule: 'path-aliases', files: [{ path: 'apps/web-app/src/a.ts' }], detail: 'a relative import' }] }),
	});
	const webAppGroup: StandardsGroup = { ...groupOf({ rules: [judgmentRule] }), packages: ['web-app'] };

	return { cwd, driver, onProgress, webAppGroup };
};

describe('collectBatchAdvisories', () => {
	test('every machine advisory standing on the batch’s files is included, whichever rule reported it', async () => {
		const { driver, onProgress } = setupDriver({ text: JSON.stringify({ findings: [] }) });

		const advisories = await collectBatchAdvisories({
			cwd: await freshCwd(),
			runId: 'run-01',
			driver,
			batch: batch({ paths: ['src/a.ts'] }),
			groups: [],
			findings: [
				finding(),
				finding({ rule: 'dead-export', siteKey: 'dead-export:src/a.ts' }),
				// a different file's advisory belongs to a different batch
				finding({ rule: 'function-size', siteKey: 'function-size:src/b.ts', files: [{ path: 'src/b.ts' }] }),
				// and blocking work is never advice
				finding({ rule: 'multi-export', severity: StandardsSeverity.Blocking, siteKey: 'multi-export:src/a.ts' }),
			],
			packagesDir: 'packages',
			agentReview: true,
			timeoutMs: 1000,
			onProgress,
		});

		expect(advisories.map((entry) => entry.siteKey)).toStrictEqual(['function-size:src/a.ts', 'dead-export:src/a.ts']);
	});

	test('the agent’s read of the judgment rules joins the same list, after the machine’s', async () => {
		const { driver, onProgress } = setupDriver({
			text: JSON.stringify({ findings: [{ rule: 'path-aliases', files: [{ path: 'src/a.ts' }], detail: 'a relative import' }] }),
		});

		const advisories = await collectBatchAdvisories({
			cwd: await freshCwd(),
			runId: 'run-01',
			driver,
			batch: batch({ paths: ['src/a.ts'] }),
			groups: [groupOf({ rules: [judgmentRule] })],
			findings: [finding()],
			packagesDir: 'packages',
			agentReview: true,
			timeoutMs: 1000,
			onProgress,
		});

		expect(advisories.map((entry) => entry.rule)).toStrictEqual(['function-size', 'acme/path-aliases']);
		// and it arrives as advice, like everything else in this list
		expect(advisories[1]?.severity).toBe(StandardsSeverity.Advisory);
	});

	test('code-checks-only mode keeps the machine advisories and never spends an agent', async () => {
		const driver: Driver = {
			name: 'stub',
			invoke: async () => {
				throw new Error('the reviewer must not be invoked when the caller opted out');
			},
		};

		const advisories = await collectBatchAdvisories({
			cwd: await freshCwd(),
			runId: 'run-01',
			driver,
			batch: batch({ paths: ['src/a.ts'] }),
			groups: [groupOf({ rules: [judgmentRule] })],
			findings: [finding()],
			packagesDir: 'packages',
			agentReview: false,
			timeoutMs: 1000,
			onProgress: () => undefined,
		});

		expect(advisories.map((entry) => entry.siteKey)).toStrictEqual(['function-size:src/a.ts']);
	});

	test('a review that could not run leaves a note against the batch and no findings', async () => {
		const { driver, progress, onProgress } = setupDriver({ text: 'prose, not a report' });

		const advisories = await collectBatchAdvisories({
			cwd: await freshCwd(),
			runId: 'run-01',
			driver,
			batch: batch({ paths: ['src/a.ts'] }),
			groups: [groupOf({ rules: [judgmentRule] })],
			findings: [],
			packagesDir: 'packages',
			agentReview: true,
			timeoutMs: 1000,
			onProgress,
		});

		// the batch is still real work — a missing answer must not stop it
		expect(advisories).toStrictEqual([]);
		expect(progress.some((line) => line.startsWith('batch-01:multi-export:src: agent review skipped — '))).toBe(true);
	});

	test('forwards packagesDir to the batch review', async () => {
		const { cwd, driver, onProgress, webAppGroup } = await setupAppsWorkspace();

		const advisories = await collectBatchAdvisories({
			cwd,
			runId: 'run-01',
			driver,
			batch: batch({ paths: ['apps/web-app/src/a.ts'] }),
			groups: [webAppGroup],
			findings: [],
			agentReview: true,
			timeoutMs: 1000,
			onProgress,
			packagesDir: 'apps',
		});

		// the finding survives only when the review places apps/web-app in the web-app group
		expect(advisories.map((entry) => entry.siteKey)).toStrictEqual(['acme/path-aliases:apps/web-app/src/a.ts']);
	});
});
