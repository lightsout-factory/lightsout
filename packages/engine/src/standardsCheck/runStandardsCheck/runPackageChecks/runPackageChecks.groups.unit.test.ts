import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { type RawStandardsFinding, type StandardsCheckFunction, type StandardsCheckInputs, StandardsInputKind } from '@lightsout/standards-contracts';
import type { LoadedStandardsRule } from '#src/common/types/LoadedStandardsRule.ts';
import type { ResolvedRuleState } from '#src/common/types/ResolvedRuleState.ts';
import type { StandardsGroup } from '#src/common/types/StandardsGroup.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { runPackageChecks } from '#src/standardsCheck/runStandardsCheck/runPackageChecks/runPackageChecks.ts';

/** One source file per place a finding can live: the repo root, the engine package and the web-app package. */
const siteFiles = {
	root: 'src/root.ts',
	engine: 'packages/engine/src/engine.ts',
	'web-app': 'packages/web-app/src/app.ts',
} as const;

type Site = keyof typeof siteFiles;

interface CheckCall {
	inputs: StandardsCheckInputs;
	options: Record<string, number>;
}

/** A monorepo with root files and two workspace packages, `engine` and `web-app`. */
const setupMonorepo = () => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-package-checks-groups-'));

	mkdirSync(join(cwd, 'src'), { recursive: true });
	mkdirSync(join(cwd, 'packages/engine/src'), { recursive: true });
	mkdirSync(join(cwd, 'packages/web-app/src'), { recursive: true });
	writeFileSync(join(cwd, siteFiles.root), 'export const root = 1;\n');
	writeFileSync(join(cwd, siteFiles.engine), 'export const engine = 2;\n');
	writeFileSync(join(cwd, siteFiles['web-app']), 'export const app = 3;\n');
	writeFileSync(join(cwd, 'packages/engine/package.json'), '{ "name": "@acme/engine" }\n');
	writeFileSync(join(cwd, 'packages/web-app/package.json'), '{ "name": "@acme/web-app" }\n');
	writeFileSync(join(cwd, 'tsconfig.json'), '{ "compilerOptions": { "strict": true } }\n');

	return { cwd };
};

/**
 * The checked rule `acme/size`, whose check records each call and reports one
 * site in each of `sites`. A finding's detail names the `cap` it ran with, so a
 * test can tell which run a finding came from.
 */
const sizeRule = ({ sites }: { sites: Site[] }) => {
	const calls: CheckCall[] = [];
	const run: StandardsCheckFunction = ({ inputs, options }) => {
		calls.push({ inputs, options });

		return sites.map((site): RawStandardsFinding => ({ siteKey: `size:${site}`, files: [{ path: siteFiles[site] }], detail: `cap ${options.cap ?? 'none'}` }));
	};
	const rule: LoadedStandardsRule = {
		id: 'size',
		name: 'acme/size',
		library: 'acme',
		set: 'code',
		documentPath: 'code/style-guide/structure/module-api',
		summary: 'a file too big to read',
		prose: 'the argument for the rule',
		deterministic: true,
		agent: false,
		defaultSeverity: StandardsSeverity.Advisory,
		defaultOptions: {},
		requires: [],
		fixturesPath: '/packages/acme/size/fixtures',
		inputKinds: [StandardsInputKind.FileList],
		run,
	};

	return { rule, calls };
};

/** One group covering `packages`; its pack holds `rule` at `state`, or holds no rule when `state` is absent. */
const groupOf = ({ packages, rule, state }: { packages: string[]; rule: LoadedStandardsRule; state?: ResolvedRuleState }): StandardsGroup => ({
	packages,
	pack: {
		name: `acme/${packages.join('-') || 'root'}`,
		topics: [],
		rules: state === undefined ? [] : [{ rule, severity: state.severity, options: state.options }],
		conditionalPacks: [],
		inactiveRules: [],
	},
	states: state === undefined ? new Map() : new Map([[rule.name, state]]),
});

const stateOf = ({ severity, options = {} }: { severity: StandardsSeverity; options?: Record<string, number> }): ResolvedRuleState => ({
	severity,
	options,
	fromConfig: false,
	reachesAgents: severity !== StandardsSeverity.Off,
});

/** The findings reduced to what a test compares, in site-key order — the order the check reported them in is not the contract. */
const summarize = ({ findings }: { findings: Array<{ siteKey: string; severity: string; detail: string }> }) =>
	findings.map(({ siteKey, severity, detail }) => ({ siteKey, severity, detail })).sort((left, right) => left.siteKey.localeCompare(right.siteKey));

/** The rule is `blocking` in the root-and-engine group and `advisory` in the web-app group; the check finds a site in each package. */
const setupSplitSeverity = () => {
	const { cwd } = setupMonorepo();
	const { rule } = sizeRule({ sites: ['engine', 'web-app'] });
	const groups = [
		groupOf({ packages: ['', 'engine'], rule, state: stateOf({ severity: StandardsSeverity.Blocking }) }),
		groupOf({ packages: ['web-app'], rule, state: stateOf({ severity: StandardsSeverity.Advisory }) }),
	];

	return { cwd, groups };
};

/**
 * The rule is live in the engine group, `off` in the web-app group, and not in
 * the root group's pack at all; the check finds a site in each of the three.
 */
const setupOffAndMissing = () => {
	const { cwd } = setupMonorepo();
	const { rule, calls } = sizeRule({ sites: ['root', 'engine', 'web-app'] });
	const groups = [
		groupOf({ packages: [''], rule }),
		groupOf({ packages: ['engine'], rule, state: stateOf({ severity: StandardsSeverity.Advisory }) }),
		groupOf({ packages: ['web-app'], rule, state: stateOf({ severity: StandardsSeverity.Off }) }),
	];

	return { cwd, groups, calls };
};

/** The rule runs at `{ cap: 50 }` for the root and engine and at `{ cap: 80 }` for web-app; every run finds the same sites in both packages. */
const setupSplitOptions = () => {
	const { cwd } = setupMonorepo();
	const { rule, calls } = sizeRule({ sites: ['engine', 'web-app'] });
	const groups = [
		groupOf({ packages: ['', 'engine'], rule, state: stateOf({ severity: StandardsSeverity.Advisory, options: { cap: 50 } }) }),
		groupOf({ packages: ['web-app'], rule, state: stateOf({ severity: StandardsSeverity.Advisory, options: { cap: 80 } }) }),
	];

	return { cwd, groups, calls };
};

/** One group covering only web-app, checked with the path scoped to web-app, by a check that finds a site in web-app and one in engine. */
const setupScopedToWebApp = () => {
	const { cwd } = setupMonorepo();
	const { rule, calls } = sizeRule({ sites: ['web-app', 'engine'] });
	const groups = [groupOf({ packages: ['web-app'], rule, state: stateOf({ severity: StandardsSeverity.Advisory }) })];

	return { cwd, groups, calls };
};

describe('runPackageChecks', () => {
	test('grades each finding with the severity of the group holding its first file', async () => {
		const { cwd, groups } = setupSplitSeverity();

		const { findings } = await runPackageChecks({ cwd, groups });

		expect(summarize({ findings })).toStrictEqual([
			{ siteKey: 'acme/size:engine', severity: StandardsSeverity.Blocking, detail: 'cap none' },
			{ siteKey: 'acme/size:web-app', severity: StandardsSeverity.Advisory, detail: 'cap none' },
		]);
	});

	test("drops a finding whose first file's group runs the rule off or does not hold it", async () => {
		const { cwd, groups, calls } = setupOffAndMissing();

		const { findings } = await runPackageChecks({ cwd, groups });

		expect({ runs: calls.length, findings: summarize({ findings }) }).toStrictEqual({
			runs: 1,
			findings: [{ siteKey: 'acme/size:engine', severity: StandardsSeverity.Advisory, detail: 'cap none' }],
		});
	});

	test("runs a rule once per distinct options and keeps each run's findings for the groups holding those options", async () => {
		const { cwd, groups, calls } = setupSplitOptions();

		const { findings } = await runPackageChecks({ cwd, groups });

		const optionsRun = calls.map((call) => call.options).sort((left, right) => (left.cap ?? 0) - (right.cap ?? 0));

		expect({ optionsRun, findings: summarize({ findings }) }).toStrictEqual({
			optionsRun: [{ cap: 50 }, { cap: 80 }],
			findings: [
				{ siteKey: 'acme/size:engine', severity: StandardsSeverity.Advisory, detail: 'cap 50' },
				{ siteKey: 'acme/size:web-app', severity: StandardsSeverity.Advisory, detail: 'cap 80' },
			],
		});
	});

	test('hands every check the whole repo as reference files but keeps only findings in files a group covers', async () => {
		const { cwd, groups, calls } = setupScopedToWebApp();

		const { findings } = await runPackageChecks({ cwd, groups, path: 'packages/web-app' });

		const referenceFiles = calls[0]?.inputs[StandardsInputKind.FileList]?.referenceFiles ?? [];

		expect({ referenceFiles, findings: summarize({ findings }) }).toStrictEqual({
			referenceFiles: expect.arrayContaining([siteFiles.root, siteFiles.engine, siteFiles['web-app']]),
			findings: [{ siteKey: 'acme/size:web-app', severity: StandardsSeverity.Advisory, detail: 'cap none' }],
		});
	});
});
