import { describe, expect, test } from '@jest/globals';
import type { ResolvedRuleState } from '#src/common/types/ResolvedRuleState.ts';
import type { StandardsGroup } from '#src/common/types/StandardsGroup.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { dropExcludedFindings } from '#src/standardsCheck/common/dropExcludedFindings.ts';

interface RuleExcludes {
	packExclude?: string[];
	repoExclude?: string[];
}

const findingOf = ({ rule, paths }: { rule: string; paths: string[] }): StandardsFinding => ({
	rule,
	severity: StandardsSeverity.Advisory,
	siteKey: `${rule}:${paths.join(',')}`,
	files: paths.map((path) => ({ path })),
	detail: 'a finding',
});

/** One group holding a state for each rule in `rules`, with that rule's excludes; every file is graded by it. */
const setupGroup = ({ rules }: { rules: Record<string, RuleExcludes> }) => {
	const states = new Map<string, ResolvedRuleState>(
		Object.entries(rules).map(([rule, { packExclude = [], repoExclude = [] }]) => [
			rule,
			{ severity: StandardsSeverity.Advisory, options: {}, fromConfig: false, reachesAgents: true, packExclude, repoExclude },
		]),
	);
	const group: StandardsGroup = {
		packages: ['', 'web'],
		pack: { name: 'acme/house', topics: [], rules: [], conditionalPacks: [], inactiveRules: [] },
		states,
	};
	const groupOfFile = (): StandardsGroup | undefined => group;
	const drop = (findings: StandardsFinding[]) => dropExcludedFindings({ findings, groupOfFile, packagesDir: 'packages', workspacePackages: ['web'] });

	return { drop };
};

describe('dropExcludedFindings', () => {
	test('dropExcludedFindings: drops a finding when every file matches a pack glob relative to its own package', () => {
		const { drop } = setupGroup({ rules: { 'acme/rule': { packExclude: ['src/routes/**'] } } });
		const routeFinding = findingOf({ rule: 'acme/rule', paths: ['packages/web/src/routes/home.ts'] });
		const appFinding = findingOf({ rule: 'acme/rule', paths: ['packages/web/src/app.ts'] });

		const { findings } = drop([routeFinding, appFinding]);

		expect(findings).toStrictEqual([appFinding]);
	});

	test('dropExcludedFindings: keeps a finding when any file it names is not excluded', () => {
		const { drop } = setupGroup({ rules: { 'acme/rule': { packExclude: ['src/routes/**'] } } });
		const finding = findingOf({ rule: 'acme/rule', paths: ['packages/web/src/routes/home.ts', 'packages/web/src/app.ts'] });

		const result = drop([finding]);

		expect(result).toStrictEqual({ findings: [finding], notes: [] });
	});

	test('dropExcludedFindings: matches repo globs against the repo-relative path only', () => {
		const { drop } = setupGroup({
			rules: {
				'acme/package-relative': { repoExclude: ['src/routes/**'] },
				'acme/repo-relative': { repoExclude: ['packages/web/src/routes/**'] },
			},
		});
		const packageRelativeFinding = findingOf({ rule: 'acme/package-relative', paths: ['packages/web/src/routes/home.ts'] });
		const repoRelativeFinding = findingOf({ rule: 'acme/repo-relative', paths: ['packages/web/src/routes/home.ts'] });

		const { findings } = drop([packageRelativeFinding, repoRelativeFinding]);

		expect(findings).toStrictEqual([packageRelativeFinding]);
	});

	test('dropExcludedFindings: matches pack globs from the repo root for a file outside every workspace package', () => {
		const { drop } = setupGroup({ rules: { 'acme/rule': { packExclude: ['src/routes/**'] } } });
		const rootFinding = findingOf({ rule: 'acme/rule', paths: ['src/routes/top.ts'] });
		const scratchFinding = findingOf({ rule: 'acme/rule', paths: ['packages/scratch/src/routes/x.ts'] });

		const { findings } = drop([rootFinding, scratchFinding]);

		expect(findings).toStrictEqual([scratchFinding]);
	});

	test('dropExcludedFindings: reads a finding on a package folder itself as that package root under pack globs, and by its repo path under repo globs', () => {
		const { drop } = setupGroup({
			rules: {
				'acme/pack-glob': { packExclude: ['packages/web'] },
				'acme/repo-glob': { repoExclude: ['packages/web'] },
			},
		});
		const packGlobFinding = findingOf({ rule: 'acme/pack-glob', paths: ['packages/web'] });
		const repoGlobFinding = findingOf({ rule: 'acme/repo-glob', paths: ['packages/web'] });

		const { findings } = drop([packGlobFinding, repoGlobFinding]);

		expect(findings).toStrictEqual([packGlobFinding]);
	});

	test('dropExcludedFindings: keeps a finding that names no file or whose group does not hold its rule', () => {
		const { drop } = setupGroup({ rules: { 'acme/held': { packExclude: ['**'], repoExclude: ['**'] } } });
		const noFileFinding = findingOf({ rule: 'acme/held', paths: [] });
		const unheldFinding = findingOf({ rule: 'acme/unheld', paths: ['src/a.ts'] });

		const result = drop([noFileFinding, unheldFinding]);

		expect(result).toStrictEqual({ findings: [noFileFinding, unheldFinding], notes: [] });
	});

	test('dropExcludedFindings: reaches a dot-folder only through a glob that names it', () => {
		const { drop } = setupGroup({
			rules: {
				'acme/broad': { packExclude: ['**/*.ts'] },
				'acme/named': { packExclude: ['.storybook/**'] },
			},
		});
		const broadFinding = findingOf({ rule: 'acme/broad', paths: ['.storybook/main.ts'] });
		const namedFinding = findingOf({ rule: 'acme/named', paths: ['.storybook/main.ts'] });

		const { findings } = drop([broadFinding, namedFinding]);

		expect(findings).toStrictEqual([broadFinding]);
	});

	test('dropExcludedFindings: states one count note per rule, ordered by rule name, and none when nothing is dropped', () => {
		const { drop } = setupGroup({
			rules: {
				'acme/zeta': { packExclude: ['src/generated/**'] },
				'acme/alpha': { packExclude: ['src/generated/**'] },
			},
		});

		const excludedFindings = [
			findingOf({ rule: 'acme/zeta', paths: ['packages/web/src/generated/a.ts'] }),
			findingOf({ rule: 'acme/alpha', paths: ['packages/web/src/generated/b.ts'] }),
			findingOf({ rule: 'acme/zeta', paths: ['packages/web/src/generated/c.ts'] }),
		];
		const keptFindings = [findingOf({ rule: 'acme/zeta', paths: ['packages/web/src/app.ts'] })];

		const dropped = drop(excludedFindings);
		const nothingDropped = drop(keptFindings);

		expect({ dropped: dropped.notes, nothingDropped: nothingDropped.notes }).toStrictEqual({
			dropped: [
				"1 finding(s) of acme/alpha dropped — every file they name matches the rule's exclude list",
				"2 finding(s) of acme/zeta dropped — every file they name matches the rule's exclude list",
			],
			nothingDropped: [],
		});
	});
});
