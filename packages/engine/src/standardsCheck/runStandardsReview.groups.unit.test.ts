import { describe, expect, test } from '@jest/globals';
import { StandardsPackSource } from '#src/contracts/standards/StandardsPackSource.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import type { DriverInvocation } from '#src/drivers/common/types/DriverInvocation.ts';
import type { StandardsGroup } from '#src/standards/common/types/StandardsGroup.ts';
import type { ResolvedRuleState } from '#src/standardsCheck/common/types/ResolvedRuleState.ts';
import { runStandardsReview } from '#src/standardsCheck/runStandardsReview.ts';
import type { LoadedStandardsRule } from '#src/standardsLibraries/common/types/LoadedStandardsRule.ts';
import { freshCwd } from '#tests/helpers/freshCwd.ts';
import { writeRepoFile } from '#tests/helpers/writeRepoFile.ts';

// How the review follows the package a file lives in when the packs split per
// package: which packages each judgment rule is put to the reviewer for, and
// which reported findings a file's own group refuses.

const rule = (overrides: Partial<LoadedStandardsRule> & { id: string }): LoadedStandardsRule => ({
	name: `acme/${overrides.id}`,
	library: 'acme',
	set: 'code',
	documentPath: 'code/architecture/folder-structure',
	summary: 'a rule',
	prose: `the argument for ${overrides.id}`,
	channel: 'base',
	checked: false,
	defaultSeverity: StandardsSeverity.Advisory,
	defaultOptions: {},
	requires: [],
	fixturesPath: `/packages/acme/${overrides.id}/fixtures`,
	...overrides,
});

/** A group covering `packages` whose pack holds `rules`; each rule in `off` is set off by the repo's rule settings. */
const groupOf = ({ packages, rules, off = [] }: { packages: string[]; rules: LoadedStandardsRule[]; off?: LoadedStandardsRule[] }): StandardsGroup => ({
	packages,
	pack: { name: 'acme/house', topics: [], rules: rules.map((entry) => ({ rule: entry, severity: entry.defaultSeverity, options: entry.defaultOptions })) },
	source: StandardsPackSource.Named,
	states: new Map<string, ResolvedRuleState>(
		rules.map((entry) => [
			entry.name,
			off.includes(entry)
				? { severity: StandardsSeverity.Off, options: entry.defaultOptions, fromConfig: true, reachesAgents: true }
				: { severity: entry.defaultSeverity, options: entry.defaultOptions, fromConfig: false, reachesAgents: true },
		]),
	),
});

const files = ['src/root.ts', 'packages/engine/src/a.ts', 'packages/web-app/src/b.ts'];

/**
 * A repo whose workspace holds `engine` and `web-app` under `packages/`, and a
 * stub harness that reports `reported` and records every invocation.
 */
const setupReview = async ({ groups, reported = [] }: { groups: StandardsGroup[]; reported?: Record<string, unknown>[] }) => {
	const cwd = await freshCwd();

	for (const name of ['engine', 'web-app']) {
		writeRepoFile({ cwd, path: `packages/${name}/package.json`, content: JSON.stringify({ name: `@acme/${name}` }) });
	}

	const invocations: DriverInvocation[] = [];
	const driver: Driver = {
		name: 'stub',
		invoke: async (invocation) => {
			invocations.push(invocation);

			return { text: JSON.stringify({ findings: reported }), exitCode: 0 };
		},
	};

	return { cwd, driver, groups, invocations };
};

/** Root and engine share one group; web-app's group also holds a rule only it runs. */
const setupSplitPacks = ({ reported }: { reported?: Record<string, unknown>[] } = {}) => {
	const everywhere = rule({ id: 'everywhere' });
	const webOnly = rule({ id: 'web-only' });

	return setupReview({
		groups: [groupOf({ packages: ['', 'engine'], rules: [everywhere] }), groupOf({ packages: ['web-app'], rules: [everywhere, webOnly] })],
		reported,
	});
};

/** The line after the one naming `name` that carries text — what sits directly under a rule's id. */
const lineUnderRule = ({ systemPrompt, name }: { systemPrompt: string; name: string }) => {
	const lines = systemPrompt.split('\n');
	const idLine = lines.findIndex((line) => line.includes(`\`${name}\``));

	return lines.slice(idLine + 1).find((line) => line.trim() !== '');
};

describe('runStandardsReview across package groups', () => {
	test('tells the reviewer which packages a judgment rule applies to when it does not apply everywhere', async () => {
		const { cwd, driver, groups, invocations } = await setupSplitPacks();

		await runStandardsReview({ cwd, driver, groups, files, packagesDir: 'packages' });

		const systemPrompt = invocations[0]?.systemPrompt ?? '';
		const underWebOnly = lineUnderRule({ systemPrompt, name: 'acme/web-only' });
		const underEverywhere = lineUnderRule({ systemPrompt, name: 'acme/everywhere' });

		// a rule every package runs goes straight to its prose; the narrower one is scoped first
		expect({ namesWebApp: underWebOnly?.includes('web-app'), isProse: underWebOnly === 'the argument for web-only', underEverywhere }).toStrictEqual({
			namesWebApp: true,
			isProse: false,
			underEverywhere: 'the argument for everywhere',
		});
	});

	test("drops a review finding whose first file's group does not hold the rule, and counts it in a note", async () => {
		const { cwd, driver, groups } = await setupSplitPacks({
			reported: [
				{ rule: 'acme/web-only', files: [{ path: 'packages/engine/src/a.ts' }], detail: 'engine does not run this rule' },
				{ rule: 'acme/web-only', files: [{ path: 'packages/web-app/src/b.ts' }], detail: 'web-app runs this rule' },
			],
		});

		const { findings, notes } = await runStandardsReview({ cwd, driver, groups, files, packagesDir: 'packages' });

		expect({ notes, keys: findings.map((finding) => ({ rule: finding.rule, siteKey: finding.siteKey })) }).toStrictEqual({
			notes: ["agent review: 1 finding(s) dropped — the file's package does not run acme/web-only"],
			keys: [{ rule: 'acme/web-only', siteKey: 'acme/web-only:packages/web-app/src/b.ts' }],
		});
	});

	test('drops a review finding whose file no group covers or whose group runs the rule off, with its own note for each', async () => {
		const judge = rule({ id: 'judge' });
		const { cwd, driver, groups } = await setupReview({
			groups: [groupOf({ packages: [''], rules: [judge] }), groupOf({ packages: ['web-app'], rules: [judge], off: [judge] })],
			reported: [
				{ rule: 'acme/judge', files: [{ path: 'packages/engine/src/a.ts' }], detail: 'engine is outside the scope' },
				{ rule: 'acme/judge', files: [{ path: 'packages/web-app/src/b.ts' }], detail: 'web-app runs this rule off' },
				{ rule: 'acme/judge', files: [{ path: 'src/root.ts' }], detail: 'the root runs this rule' },
			],
		});

		const { findings, notes } = await runStandardsReview({ cwd, driver, groups, files, packagesDir: 'packages' });

		expect({ notes: [...notes].sort(), keys: findings.map((finding) => finding.siteKey) }).toStrictEqual({
			notes: [
				"agent review: 1 finding(s) dropped — no standards group covers the file's package",
				"agent review: 1 finding(s) dropped — the file's package does not run acme/judge",
			],
			keys: ['acme/judge:src/root.ts'],
		});
	});
});
