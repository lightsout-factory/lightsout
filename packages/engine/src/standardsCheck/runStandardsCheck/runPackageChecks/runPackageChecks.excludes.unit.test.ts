import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { type RawStandardsFinding, type StandardsCheckFunction, StandardsInputKind } from '@lightsout/standards-contracts';
import type { LoadedStandardsRule } from '#src/common/types/LoadedStandardsRule.ts';
import type { ResolvedRuleState } from '#src/common/types/ResolvedRuleState.ts';
import type { StandardsGroup } from '#src/common/types/StandardsGroup.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { runPackageChecks } from '#src/standardsCheck/runStandardsCheck/runPackageChecks/runPackageChecks.ts';
import { sourceFileGlobs } from '#tests/helpers/sourceFileGlobs.ts';
import { testFileGlobs } from '#tests/helpers/testFileGlobs.ts';

/** A monorepo whose workspace packages each hold the given repo-relative source files. */
const setupMonorepo = ({ packages, files }: { packages: string[]; files: string[] }) => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-package-checks-excludes-'));

	for (const name of packages) {
		mkdirSync(join(cwd, 'packages', name), { recursive: true });
		writeFileSync(join(cwd, 'packages', name, 'package.json'), `{ "name": "@acme/${name}" }\n`);
	}

	for (const file of files) {
		mkdirSync(join(cwd, dirname(file)), { recursive: true });
		writeFileSync(join(cwd, file), 'export const value = 1;\n');
	}

	writeFileSync(join(cwd, 'tsconfig.json'), '{ "compilerOptions": { "strict": true } }\n');

	return { cwd };
};

/** The checked rule `acme/size`, whose check reports one finding on every file it is handed and records the files it saw. */
const everyFileRule = () => {
	const seen: string[][] = [];
	const run: StandardsCheckFunction = ({ inputs }) => {
		const files = inputs[StandardsInputKind.FileList]?.files ?? [];

		seen.push(files);

		return files.map((path): RawStandardsFinding => ({ siteKey: `size:${path}`, files: [{ path }], detail: 'too big' }));
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

	return { rule, seen };
};

/** One group covering `packages` whose pack holds `rule` advisory, with `packExclude` as the rule's pack excludes. */
const groupOf = ({ packages, rule, packExclude }: { packages: string[]; rule: LoadedStandardsRule; packExclude: string[] }): StandardsGroup => {
	const state: ResolvedRuleState = {
		severity: StandardsSeverity.Advisory,
		options: {},
		fromConfig: false,
		reachesAgents: true,
		packExclude,
		repoExclude: [],
	};

	return {
		packages,
		pack: {
			name: `acme/${packages.join('-')}`,
			topics: [],
			rules: [{ rule, severity: state.severity, options: state.options, exclude: packExclude }],
			conditionalPacks: [],
			inactiveRules: [],
		},
		states: new Map([[rule.name, state]]),
	};
};

/** The web-app group excludes `src/routes/**` from a rule whose check reports every file. */
const setupRoutesExcluded = () => {
	const { cwd } = setupMonorepo({ packages: ['web-app'], files: ['packages/web-app/src/app.ts', 'packages/web-app/src/routes/home.ts'] });
	const { rule, seen } = everyFileRule();
	const groups = [groupOf({ packages: ['web-app'], rule, packExclude: ['src/routes/**'] })];

	return { cwd, groups, seen };
};

/** The engine group excludes `src/**` and the web-app group excludes nothing, from a rule whose check reports every file. */
const setupSplitExcludes = () => {
	const { cwd } = setupMonorepo({ packages: ['engine', 'web-app'], files: ['packages/engine/src/engine.ts', 'packages/web-app/src/app.ts'] });
	const { rule } = everyFileRule();
	const groups = [groupOf({ packages: ['engine'], rule, packExclude: ['src/**'] }), groupOf({ packages: ['web-app'], rule, packExclude: [] })];

	return { cwd, groups };
};

describe('runPackageChecks', () => {
	test('runPackageChecks: drops an excluded finding after the check saw every file, and notes the drop', async () => {
		const { cwd, groups, seen } = setupRoutesExcluded();

		const { findings, notes } = await runPackageChecks({ cwd, sourceFileGlobs, testFileGlobs, groups });

		expect({ seen, files: findings.map((finding) => finding.files.map((file) => file.path)), notes }).toStrictEqual({
			seen: [expect.arrayContaining(['packages/web-app/src/app.ts', 'packages/web-app/src/routes/home.ts'])],
			files: [['packages/web-app/src/app.ts']],
			notes: [expect.stringMatching(/^1 finding\(s\) of acme\/size dropped/)],
		});
	});

	test("runPackageChecks: a group's excludes drop only the findings that group grades", async () => {
		const { cwd, groups } = setupSplitExcludes();

		const { findings } = await runPackageChecks({ cwd, sourceFileGlobs, testFileGlobs, groups });

		expect(findings.map((finding) => finding.files.map((file) => file.path))).toStrictEqual([['packages/web-app/src/app.ts']]);
	});
});
