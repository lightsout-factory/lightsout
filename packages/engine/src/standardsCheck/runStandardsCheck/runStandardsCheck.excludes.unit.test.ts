import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { expect, test } from '@jest/globals';
import { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { StandardsRuleSettings } from '#src/contracts/StandardsRuleSettings.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { runStandardsCheck } from '#src/standardsCheck/runStandardsCheck/runStandardsCheck.ts';
import { sourceFileGlobs } from '#tests/helpers/sourceFileGlobs.ts';
import { testFileGlobs } from '#tests/helpers/testFileGlobs.ts';

/** Write a set of relative files under `dir`, creating the folders they need. */
const writeTree = ({ dir, files }: { dir: string; files: Record<string, string> }) => {
	for (const [rel, content] of Object.entries(files)) {
		mkdirSync(dirname(join(dir, rel)), { recursive: true });
		writeFileSync(join(dir, rel), content);
	}
};

/**
 * A library of somebody's own with one advisory rule, `acme/every-file`, whose
 * check reports every source file it is handed. Pack `acme/general` brings the
 * rule in; pack `acme/framework` includes `acme/general` and excludes the
 * framework's `src/routes/**` from that rule. It sits outside the repo it
 * checks, so its own files never show up in that repo's file list.
 */
const writeExcludesLibrary = () => {
	const libraryPath = mkdtempSync(join(tmpdir(), 'lightsout-excludes-standards-'));

	writeTree({
		dir: libraryPath,
		files: {
			'lightsout-standards.json': '{ "name": "acme", "formatVersion": 2 }\n',
			'rules/code/general/topic.md': '# General\n\nWhat every file agrees on.\n',
			'rules/code/general/05-every-file/rule.md':
				'---\nsummary: a source file the rule reports\nchecks: deterministic\nseverity: advisory\n---\n\nEvery source file is reported.\n',
			'rules/code/general/05-every-file/check.ts':
				'export const check = {\n' +
				"\tinputKinds: ['file-list'],\n" +
				'\trun: ({ inputs }) => inputs["file-list"].files.map((path) => ({ siteKey: `every-file:${path}`, files: [{ path }], detail: `${path} is reported` })),\n' +
				'};\n',
			'rules/code/general/05-every-file/fixtures/pass/src/mod/index.ts': 'export const mod = 1;\n',
			'rules/code/general/05-every-file/fixtures/fail/src/loose.ts': 'export const loose = 1;\n',
			'packs/general.json': JSON.stringify({ description: 'the general pack', include: { topics: ['acme/code/general'] } }),
			'packs/framework.json': JSON.stringify({
				description: 'the framework pack',
				include: { packs: ['acme/general'] },
				'rule-settings': { 'acme/every-file': { exclude: ['src/routes/**'] } },
			}),
		},
	});

	return libraryPath;
};

/** A repo with one workspace package, `web`, holding an app file, a routes file and a legacy file. */
const writeExcludesRepo = () => {
	const dir = mkdtempSync(join(tmpdir(), 'lightsout-standards-excludes-'));

	writeTree({
		dir,
		files: {
			'packages/web/package.json': JSON.stringify({ name: 'web' }),
			'packages/web/src/app.ts': 'export const app = 1;\n',
			'packages/web/src/routes/home.ts': 'export const home = 2;\n',
			'packages/web/src/legacy/old.ts': 'export const old = 3;\n',
		},
	});

	return dir;
};

/** The repo's config: `web` on `pack` from the excludes library, with the repo's own rule settings when given. */
const buildConfig = ({ libraryPath, pack, ruleSettings }: { libraryPath: string; pack: string; ruleSettings?: StandardsRuleSettings }) =>
	LightsoutConfig.parse({
		'source-files': sourceFileGlobs,
		'test-files': testFileGlobs,
		gates: { check: 'true', test: 'true', 'test-coverage': false },
		'standards-libraries': { acme: libraryPath },
		'package-standards-packs': { web: pack },
		...(ruleSettings === undefined ? {} : { 'standards-rule-settings': ruleSettings }),
	});

/** What a run reported, one line per finding: rule, severity and site. */
const describeFindings = ({ findings }: { findings: StandardsFinding[] }) =>
	findings.map((finding) => `${finding.rule} ${finding.severity} ${finding.siteKey}`).sort();

const setupFrameworkPackRepo = () => {
	const dir = writeExcludesRepo();
	const config = buildConfig({ libraryPath: writeExcludesLibrary(), pack: 'acme/framework' });

	return { dir, config };
};

/** The same repo on `acme/general` alone, once excluding the legacy folder by its repo-relative path and once by its package-relative path. */
const setupRepoExcludeRepo = () => {
	const dir = writeExcludesRepo();
	const libraryPath = writeExcludesLibrary();
	const byRepoPath = buildConfig({ libraryPath, pack: 'acme/general', ruleSettings: { 'acme/every-file': { exclude: ['packages/web/src/legacy/**'] } } });
	const byPackagePath = buildConfig({ libraryPath, pack: 'acme/general', ruleSettings: { 'acme/every-file': { exclude: ['src/legacy/**'] } } });

	return { dir, byRepoPath, byPackagePath };
};

test("a framework pack excluding src/routes/** from a general rule keeps that rule out of each package's routes folder", async () => {
	const { dir, config } = setupFrameworkPackRepo();

	const { findings, notes } = await runStandardsCheck({ cwd: dir, config, persist: false });

	// the pack's glob reads from the package root, so only the routes file is dropped
	expect(describeFindings({ findings })).toStrictEqual([
		'acme/every-file advisory acme/every-file:packages/web/src/app.ts',
		'acme/every-file advisory acme/every-file:packages/web/src/legacy/old.ts',
	]);
	// the drop is counted, never silent
	expect(notes).toContainEqual(expect.stringContaining('1 finding(s) of acme/every-file dropped'));
});

test("a repo exclude drops findings by repo-relative path and leaves the rule's severity at the pack's", async () => {
	const { dir, byRepoPath, byPackagePath } = setupRepoExcludeRepo();

	const [repoRelative, packageRelative] = await Promise.all([
		runStandardsCheck({ cwd: dir, config: byRepoPath, persist: false }),
		runStandardsCheck({ cwd: dir, config: byPackagePath, persist: false }),
	]);

	// a repo glob reads the repo-relative path: the package-relative src/legacy/** drops nothing,
	// and an exclude-only entry leaves the rule advisory, as its pack ships it
	expect({ repoRelative: describeFindings(repoRelative), packageRelative: describeFindings(packageRelative) }).toStrictEqual({
		repoRelative: [
			'acme/every-file advisory acme/every-file:packages/web/src/app.ts',
			'acme/every-file advisory acme/every-file:packages/web/src/routes/home.ts',
		],
		packageRelative: [
			'acme/every-file advisory acme/every-file:packages/web/src/app.ts',
			'acme/every-file advisory acme/every-file:packages/web/src/legacy/old.ts',
			'acme/every-file advisory acme/every-file:packages/web/src/routes/home.ts',
		],
	});
});
