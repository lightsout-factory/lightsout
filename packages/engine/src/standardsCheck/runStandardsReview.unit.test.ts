import { describe, expect, test } from '@jest/globals';
import type { Driver } from '#src/common/types/Driver.ts';
import type { DriverInvocation } from '#src/common/types/DriverInvocation.ts';
import type { DriverResult } from '#src/common/types/DriverResult.ts';
import type { StandardsGroup } from '#src/common/types/StandardsGroup.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import type { ResolvedRuleState } from '#src/standardsCheck/common/types/ResolvedRuleState.ts';
import { runStandardsReview } from '#src/standardsCheck/runStandardsReview.ts';
import type { LoadedStandardsRule } from '#src/standardsLibraries/common/types/LoadedStandardsRule.ts';

const rule = (overrides: Partial<LoadedStandardsRule> & { id: string }): LoadedStandardsRule => ({
	name: `acme/${overrides.id}`,
	library: 'acme',
	set: 'code',
	documentPath: 'code/architecture/folder-structure',
	summary: 'a rule',
	prose: 'the argument for the rule',
	deterministic: false,
	agent: overrides.deterministic !== true,
	defaultSeverity: StandardsSeverity.Advisory,
	defaultOptions: {},
	requires: [],
	fixturesPath: `/packages/acme/${overrides.id}/fixtures`,
	...overrides,
});

/** One group whose pack holds `rules`, each at its rule.md default. */
const groupOf = ({ rules }: { rules: LoadedStandardsRule[] }): StandardsGroup => ({
	packages: [''],
	pack: {
		name: 'acme/house',
		topics: [],
		rules: rules.map((entry) => ({ rule: entry, severity: entry.defaultSeverity, options: entry.defaultOptions })),
		conditionalPacks: [],
		inactiveRules: [],
	},
	states: new Map<string, ResolvedRuleState>(
		rules.map((entry) => [entry.name, { severity: entry.defaultSeverity, options: entry.defaultOptions, fromConfig: false, reachesAgents: true }]),
	),
});

/** A stub harness answering every invocation with `text`, recording the prompts and the full invocations it was given. */
const setupDriver = ({ result }: { result: DriverResult | (() => DriverResult) }) => {
	const prompts: string[] = [];
	const invocations: DriverInvocation[] = [];
	const driver: Driver = {
		name: 'stub',
		invoke: async (invocation) => {
			prompts.push(invocation.prompt);
			invocations.push(invocation);

			return typeof result === 'function' ? result() : result;
		},
	};

	return { driver, prompts, invocations };
};

const reviewText = (findings: Record<string, unknown>[]) => JSON.stringify({ findings });

/**
 * One group whose pack holds two agent-checked rules the review must skip — one the
 * repo turned off, one the pack ships off — while its topic names a third
 * agent-checked rule of the library that the pack leaves out altogether.
 */
const setupExcludedJudgmentRules = () => {
	const repoOff = rule({ id: 'repo-off-judgment' });
	const packOff = rule({ id: 'pack-off-judgment', defaultSeverity: StandardsSeverity.Off });
	const group: StandardsGroup = {
		packages: [''],
		pack: {
			name: 'acme/house',
			topics: [
				{
					set: 'code',
					library: 'acme',
					path: 'code/architecture/folder-structure',
					intro: '# Folder structure',
					ruleIds: ['repo-off-judgment', 'pack-off-judgment', 'left-out-judgment'],
				},
			],
			rules: [
				{ rule: repoOff, severity: StandardsSeverity.Advisory, options: {} },
				{ rule: packOff, severity: StandardsSeverity.Off, options: {} },
			],
			conditionalPacks: [],
			inactiveRules: [],
		},
		states: new Map<string, ResolvedRuleState>([
			['acme/repo-off-judgment', { severity: StandardsSeverity.Off, options: {}, fromConfig: true, reachesAgents: true }],
			['acme/pack-off-judgment', { severity: StandardsSeverity.Off, options: {}, fromConfig: false, reachesAgents: false }],
		]),
	};
	const { driver, prompts } = setupDriver({
		result: { text: reviewText([{ rule: 'left-out-judgment', files: [{ path: 'src/a.ts' }], detail: 'should never be asked for' }]), exitCode: 0 },
	});

	return { groups: [group], driver, prompts };
};

describe('runStandardsReview', () => {
	test('a reported violation becomes an advisory finding with an engine-derived site key', async () => {
		const { driver } = setupDriver({
			result: {
				text: reviewText([
					{ rule: 'common-placement', files: [{ path: 'src/a.ts', startLine: 4 }], detail: 'promoted on one consumer', guidance: 'move it back' },
				]),
				exitCode: 0,
			},
		});

		const { findings, notes } = await runStandardsReview({
			cwd: '/repo',
			driver,
			groups: [groupOf({ rules: [rule({ id: 'common-placement' })] })],
			packagesDir: 'packages',
			files: ['src/a.ts'],
		});

		expect(notes).toStrictEqual([]);
		expect(findings).toStrictEqual([
			{
				rule: 'acme/common-placement',
				severity: StandardsSeverity.Advisory,
				siteKey: 'acme/common-placement:src/a.ts',
				files: [{ path: 'src/a.ts', startLine: 4 }],
				detail: 'promoted on one consumer',
				guidance: 'move it back',
			},
		]);
	});

	test('a review finding is never blocking, however the agent phrased it', async () => {
		const { driver } = setupDriver({
			result: { text: reviewText([{ rule: 'common-placement', severity: 'blocking', files: [{ path: 'src/a.ts' }], detail: 'MUST FIX' }]), exitCode: 0 },
		});

		const { findings } = await runStandardsReview({
			cwd: '/repo',
			driver,
			groups: [groupOf({ rules: [rule({ id: 'common-placement' })] })],
			packagesDir: 'packages',
			files: ['src/a.ts'],
		});

		// severity is the engine's to stamp — an agent cannot promote its own opinion into work
		expect(findings[0]?.severity).toBe(StandardsSeverity.Advisory);
	});

	test('a harness that cannot answer is a skipped review, not a failure', async () => {
		const { driver } = setupDriver({ result: { text: 'prose, not a report', exitCode: 0 } });

		const { findings, notes } = await runStandardsReview({
			cwd: '/repo',
			driver,
			groups: [groupOf({ rules: [rule({ id: 'common-placement' })] })],
			packagesDir: 'packages',
			files: ['src/a.ts'],
		});

		// the machine half is real evidence and must still be reported
		expect(findings).toStrictEqual([]);
		expect(notes[0]?.startsWith('agent review skipped — ')).toBe(true);
	});

	test('a rate-limited harness is skipped the same way, and never throws', async () => {
		const { driver } = setupDriver({ result: { text: '', exitCode: 1, rateLimited: true } });

		const { notes } = await runStandardsReview({
			cwd: '/repo',
			driver,
			groups: [groupOf({ rules: [rule({ id: 'common-placement' })] })],
			packagesDir: 'packages',
			files: ['src/a.ts'],
		});

		expect(notes).toStrictEqual(['agent review skipped — harness rate limited or overloaded']);
	});

	test('a rule whose check covers only part of it is still handed to the reviewer', async () => {
		const { driver, invocations } = setupDriver({
			result: { text: reviewText([{ rule: 'acme/shared-code', files: [{ path: 'src/a.ts' }], detail: 'not shared by its importers' }]), exitCode: 0 },
		});

		const { findings } = await runStandardsReview({
			cwd: '/repo',
			driver,
			groups: [groupOf({ rules: [rule({ id: 'shared-code', deterministic: true, agent: true }), rule({ id: 'multi-export', deterministic: true })] })],
			packagesDir: 'packages',
			files: ['src/a.ts'],
		});

		// the rule with both kinds of check is read, the deterministic-only one is not
		expect(invocations[0]?.systemPrompt).toContain('**Rule: `acme/shared-code`**');
		expect(invocations[0]?.systemPrompt).not.toContain('acme/multi-export');
		expect(findings.map((finding) => finding.rule)).toStrictEqual(['acme/shared-code']);
	});

	test('no agent-checked rules means no agent is spent saying so', async () => {
		const { driver, prompts } = setupDriver({ result: { text: reviewText([]), exitCode: 0 } });

		const { findings, notes } = await runStandardsReview({
			cwd: '/repo',
			driver,
			groups: [groupOf({ rules: [rule({ id: 'multi-export', deterministic: true })] })],
			packagesDir: 'packages',
			files: ['src/a.ts'],
		});

		expect(prompts).toStrictEqual([]);
		expect(findings).toStrictEqual([]);
		expect(notes).toStrictEqual([]);
	});

	test('no files in scope means no agent is spent either', async () => {
		const { driver, prompts } = setupDriver({ result: { text: reviewText([]), exitCode: 0 } });

		await runStandardsReview({
			cwd: '/repo',
			driver,
			groups: [groupOf({ rules: [rule({ id: 'common-placement' })] })],
			packagesDir: 'packages',
			files: [],
		});

		expect(prompts).toStrictEqual([]);
	});

	test('a finding the agent gave no guidance for carries none — the key is absent, not empty', async () => {
		const { driver } = setupDriver({
			result: { text: reviewText([{ rule: 'common-placement', files: [{ path: 'src/a.ts' }], detail: 'promoted on one consumer' }]), exitCode: 0 },
		});

		const { findings } = await runStandardsReview({
			cwd: '/repo',
			driver,
			groups: [groupOf({ rules: [rule({ id: 'common-placement' })] })],
			packagesDir: 'packages',
			files: ['src/a.ts'],
		});

		expect(findings[0]).toStrictEqual({
			rule: 'acme/common-placement',
			severity: StandardsSeverity.Advisory,
			siteKey: 'acme/common-placement:src/a.ts',
			files: [{ path: 'src/a.ts' }],
			detail: 'promoted on one consumer',
		});
	});

	test('a review that finds nothing reports nothing — the agent still ran', async () => {
		const { driver, prompts } = setupDriver({ result: { text: reviewText([]), exitCode: 0 } });

		const { findings, notes } = await runStandardsReview({
			cwd: '/repo',
			driver,
			groups: [groupOf({ rules: [rule({ id: 'common-placement' })] })],
			packagesDir: 'packages',
			files: ['src/a.ts'],
		});

		expect({ findings, notes, spawned: prompts.length }).toStrictEqual({ findings: [], notes: [], spawned: 1 });
	});

	test('agent-checked rules from every loaded package are put in front of the reviewer', async () => {
		const { driver, invocations } = setupDriver({ result: { text: reviewText([]), exitCode: 0 } });

		await runStandardsReview({
			cwd: '/repo',
			driver,
			groups: [groupOf({ rules: [rule({ id: 'common-placement' })] }), groupOf({ rules: [rule({ id: 'one-export' })] })],
			packagesDir: 'packages',
			files: ['src/a.ts'],
		});

		expect(invocations[0]?.systemPrompt).toContain('common-placement');
		expect(invocations[0]?.systemPrompt).toContain('one-export');
	});

	test('the review reads the target repo read-only, under the timeout the caller set', async () => {
		const { driver, invocations } = setupDriver({ result: { text: reviewText([]), exitCode: 0 } });

		await runStandardsReview({
			cwd: '/repo',
			driver,
			groups: [groupOf({ rules: [rule({ id: 'common-placement' })] })],
			packagesDir: 'packages',
			files: ['src/a.ts'],
			timeoutMs: 90_000,
		});

		// nothing a judgment call concludes may edit the repo it is reading
		expect(invocations[0]).toEqual(expect.objectContaining({ cwd: '/repo', permissions: 'read-only', timeoutMs: 90_000 }));
	});

	test('a reported rule resolves to its full name, which the finding and its site key carry', async () => {
		const { driver } = setupDriver({
			result: {
				text: reviewText([
					{ rule: 'acme/judge', files: [{ path: 'src/a.ts' }, { path: 'src/z.ts' }], detail: 'named in full' },
					{ rule: 'judge', files: [{ path: 'src/b.ts' }], detail: 'named by short id' },
				]),
				exitCode: 0,
			},
		});

		const { findings, notes } = await runStandardsReview({
			cwd: '/repo',
			driver,
			groups: [groupOf({ rules: [rule({ id: 'judge', name: 'acme/judge', library: 'acme' })] })],
			packagesDir: 'packages',
			files: ['src/a.ts', 'src/b.ts', 'src/z.ts'],
		});

		expect({ notes, keys: findings.map((finding) => ({ rule: finding.rule, siteKey: finding.siteKey })) }).toStrictEqual({
			notes: [],
			keys: [
				{ rule: 'acme/judge', siteKey: 'acme/judge:src/a.ts' },
				{ rule: 'acme/judge', siteKey: 'acme/judge:src/b.ts' },
			],
		});
	});

	test('a reported rule that resolves to no single agent-checked rule is dropped and named in a note', async () => {
		const { driver } = setupDriver({
			result: {
				text: reviewText([
					{ rule: 'nope', files: [{ path: 'src/a.ts' }], detail: 'no such rule' },
					{ rule: 'judge', files: [{ path: 'src/b.ts' }], detail: 'two libraries hold this id' },
				]),
				exitCode: 0,
			},
		});

		const { findings, notes } = await runStandardsReview({
			cwd: '/repo',
			driver,
			groups: [groupOf({ rules: [rule({ id: 'judge', name: 'acme/judge', library: 'acme' }), rule({ id: 'judge', name: 'house/judge', library: 'house' })] })],
			packagesDir: 'packages',
			files: ['src/a.ts', 'src/b.ts'],
		});

		expect({ findings, notes }).toEqual({
			findings: [],
			notes: [expect.stringMatching(/2 finding\(s\) dropped.*\bjudge\b.*\bnope\b/)],
		});
	});

	test('a harness that will not start is skipped too — nothing here throws', async () => {
		const { driver } = setupDriver({
			result: () => {
				throw new Error('spawn claude ENOENT');
			},
		});

		const { findings, notes } = await runStandardsReview({
			cwd: '/repo',
			driver,
			groups: [groupOf({ rules: [rule({ id: 'common-placement' })] })],
			packagesDir: 'packages',
			files: ['src/a.ts'],
		});

		// a repo whose harness is absent is not a repo in violation
		expect(findings).toStrictEqual([]);
		expect(notes).toStrictEqual(['agent review skipped — agent invocation failed: spawn claude ENOENT']);
	});

	test('a agent-checked rule two groups hold is reviewed once, so its short id still names one rule', async () => {
		const judge = rule({ id: 'judge' });
		const { driver } = setupDriver({
			result: { text: reviewText([{ rule: 'judge', files: [{ path: 'src/a.ts' }], detail: 'named by short id' }]), exitCode: 0 },
		});

		const { findings, notes } = await runStandardsReview({
			cwd: '/repo',
			driver,
			groups: [groupOf({ rules: [judge] }), groupOf({ rules: [judge] })],
			packagesDir: 'packages',
			files: ['src/a.ts'],
		});

		// held twice, the short id would read as ambiguous and the finding would be dropped
		expect({ notes, keys: findings.map((finding) => finding.siteKey) }).toStrictEqual({ notes: [], keys: ['acme/judge:src/a.ts'] });
	});

	test('runStandardsReview: agent-checked rules the groups turn off or leave out are never reviewed', async () => {
		const { groups, driver, prompts } = setupExcludedJudgmentRules();

		const result = await runStandardsReview({ cwd: '/repo', driver, groups, packagesDir: 'packages', files: ['src/a.ts'] });

		// no rule is left to judge, so no agent is spent — and nothing it might have said reaches the findings
		expect({ result, spawned: prompts.length }).toStrictEqual({ result: { findings: [], notes: [] }, spawned: 0 });
	});
});
