import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { StandardsCheckFunction, StandardsCheckInputs } from '@lightsout/standards-contracts';
import type { LoadedStandardsRule } from '#src/common/types/LoadedStandardsRule.ts';
import type { ResolvedRuleState } from '#src/common/types/ResolvedRuleState.ts';
import type { StandardsGroup } from '#src/common/types/StandardsGroup.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { runPackageChecks } from '#src/standardsCheck/runStandardsCheck/runPackageChecks/runPackageChecks.ts';

/** A repo the checks run against. */
const setupRepo = () => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-package-checks-'));

	mkdirSync(join(cwd, 'src/feature'), { recursive: true });
	writeFileSync(join(cwd, 'src/alpha.ts'), 'export const alpha = 1;\n');
	writeFileSync(join(cwd, 'src/feature/internal.ts'), 'export const internal = 2;\n');
	writeFileSync(join(cwd, 'src/alpha.unit.test.ts'), "test('alpha', () => {});\n");
	// A real repo has one, and without it the run rightly notes that it could not
	// know this repo's path aliases — a second note every unrelated case would
	// then have to carry.
	writeFileSync(join(cwd, 'tsconfig.json'), '{ "compilerOptions": { "strict": true } }\n');

	return { cwd };
};

const rule = (overrides: Partial<LoadedStandardsRule> & { id: string }): LoadedStandardsRule => ({
	name: `acme/${overrides.id}`,
	library: 'acme',
	set: 'code',
	documentPath: 'code/style-guide/structure/module-api',
	summary: 'a rule',
	prose: 'the argument for the rule',
	deterministic: overrides.run !== undefined,
	agent: overrides.run === undefined,
	defaultSeverity: StandardsSeverity.Advisory,
	defaultOptions: {},
	requires: [],
	fixturesPath: `/packages/acme/${overrides.id}/fixtures`,
	...overrides,
});

/** A check for the rule `id` that reports one finding and records what it was handed. */
const recordingRun = ({
	id,
	calls,
}: {
	id: string;
	calls: Array<{ inputs: StandardsCheckInputs; options: Record<string, number> }>;
}): StandardsCheckFunction => {
	return ({ inputs, options }) => {
		calls.push({ inputs, options });

		return [{ siteKey: `${id}:${Object.keys(inputs).join(',')}:one`, files: [{ path: 'src/alpha.ts' }], detail: 'one site' }];
	};
};

/** One group whose pack holds `rules` at their rule.md defaults, each rule at the state `states` resolved for it. */
const groupOf = ({ rules, states }: { rules: LoadedStandardsRule[]; states: Map<string, ResolvedRuleState> }): StandardsGroup => ({
	packages: [''],
	pack: {
		name: 'acme/house',
		topics: [],
		rules: rules.map((entry) => ({ rule: entry, severity: entry.defaultSeverity, options: entry.defaultOptions })),
		conditionalPacks: [],
		inactiveRules: [],
	},
	states,
});

/** Runs the given rules as one group's pack, at the severities a repo's config would have resolved for them. */
const runChecks = ({
	rules,
	cwd,
	severities = {},
	path,
	exclude,
	onProgress,
}: {
	rules: LoadedStandardsRule[];
	cwd: string;
	severities?: Record<string, StandardsSeverity>;
	path?: string;
	exclude?: string[];
	onProgress?: (message: string) => void;
}) => {
	const states = new Map<string, ResolvedRuleState>(
		rules.map((entry) => {
			const severity = severities[entry.id] ?? entry.defaultSeverity;

			return [entry.name, { severity, options: entry.defaultOptions, fromConfig: false, reachesAgents: severity !== StandardsSeverity.Off }];
		}),
	);

	return runPackageChecks({ cwd, groups: [groupOf({ rules, states })], path, exclude, onProgress });
};

/**
 * The repo, the rules and the one-group run a `runPackageChecks` case builds on,
 * as one vocabulary the test files for the single-group run read from.
 *
 * One copy rather than one per test file, so two files cannot disagree about
 * what the planted repo holds or how a rule's resolved state is derived.
 */
export const packageChecksFixtures = { setupRepo, rule, recordingRun, groupOf, runChecks };
