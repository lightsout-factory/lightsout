import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import { checkRuleRequirements } from '#src/doctor/checkRuleRequirements.ts';
import { resolveStandardsGroups } from '#src/standards/resolveStandardsGroups.ts';
import { getRejectionError } from '#tests/helpers/getRejectionError.ts';

const baseConfig: LightsoutConfig = { gates: { check: 'true', test: 'true', 'test-coverage': false } };

/** Writes each repo-relative file under `root`, making the folders it sits under. */
const writeFiles = ({ root, files }: { root: string; files: Record<string, string> }) => {
	for (const [path, content] of Object.entries(files)) {
		const absolutePath = join(root, path);

		mkdirSync(dirname(absolutePath), { recursive: true });
		writeFileSync(absolutePath, content);
	}
};

/**
 * A `house` library holding one topic with rules `a` (advisory, requires `b`)
 * and `b` (publisher-off), and pack `team` that includes the whole topic.
 */
const houseLibraryFiles = {
	'lightsout-standards.json': '{ "name": "house", "formatVersion": 1 }\n',
	'code/demo/topic.md': '# Demo\n\nThe topic both rules argue under.\n',
	'code/demo/01-a/rule.md': '---\nsummary: rule a\nseverity: advisory\nrequires:\n  - b\n---\n\nRule a follows rule b.\n',
	'code/demo/01-a/fixtures/pass/src/example.ts': 'export const example = 1;\n',
	'code/demo/01-a/fixtures/fail/src/example.ts': 'export const example = 2;\n',
	'code/demo/02-b/rule.md': '---\nsummary: rule b\nseverity: off\n---\n\nRule b states what rule a points at.\n',
	'code/demo/02-b/fixtures/pass/src/example.ts': 'export const example = 1;\n',
	'code/demo/02-b/fixtures/fail/src/example.ts': 'export const example = 2;\n',
	'packs/team.json': JSON.stringify({ description: 'The team pack.', include: { topics: ['house/code/demo'] } }),
};

/**
 * A temp repo with a plain root package.json and no packages folder, so the
 * root group is the only group. The built-in library is the authored lightsout
 * library the test environment points LIGHTSOUT_DEFAULT_STANDARDS at. With
 * `withHouseLibrary`, the `house` library is written under standards/house.
 */
const setupRepo = ({ withHouseLibrary = false }: { withHouseLibrary?: boolean } = {}) => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-rule-requirements-'));

	writeFiles({ root: cwd, files: { 'package.json': JSON.stringify({ name: 'repo' }) } });

	if (withHouseLibrary) {
		writeFiles({ root: join(cwd, 'standards', 'house'), files: houseLibraryFiles });
	}

	return { cwd };
};

/**
 * A temp monorepo whose plain root manifest detects lightsout/node, with
 * workspace packages `admin` and `web` both given lightsout/react through
 * `package-standards-packs`, so they share one group apart from the root's.
 */
const setupMonorepo = () => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-rule-requirements-monorepo-'));

	writeFiles({
		root: cwd,
		files: {
			'package.json': JSON.stringify({ name: 'repo' }),
			'packages/admin/package.json': JSON.stringify({ name: 'admin' }),
			'packages/web/package.json': JSON.stringify({ name: 'web' }),
		},
	});

	const config: LightsoutConfig = { ...baseConfig, 'package-standards-packs': { admin: 'lightsout/react', web: 'lightsout/react' } };

	return { cwd, config };
};

/** The requiring and required rules the lightsout/react pack leaves out, as full names. */
const reactMissingRequirements = [
	{ rule: 'lightsout/component-file-structure', required: 'lightsout/folder-index-file' },
	{ rule: 'lightsout/component-file-structure', required: 'lightsout/module-folder-layout' },
	{ rule: 'lightsout/component-file-structure', required: 'lightsout/single-file-domain-folder' },
	{ rule: 'lightsout/component-file-structure', required: 'lightsout/ungrouped-domain-utils' },
	{ rule: 'lightsout/react-domain-folders', required: 'lightsout/folder-index-file' },
	{ rule: 'lightsout/react-domain-folders', required: 'lightsout/module-out-of-common' },
	{ rule: 'lightsout/react-domain-folders', required: 'lightsout/ungrouped-domain-utils' },
	{ rule: 'lightsout/file-naming-conventions', required: 'lightsout/filename-mismatch' },
	{ rule: 'lightsout/file-naming-conventions', required: 'lightsout/folder-casing' },
];

describe('checkRuleRequirements', () => {
	test('returns undefined when no standards group resolves', async () => {
		const { cwd } = setupRepo();
		const config: LightsoutConfig = { ...baseConfig, 'standards-pack': false };

		const check = await checkRuleRequirements({ cwd, config });

		expect(check).toBe(undefined);
	});

	test("passes when every group's pack sends each required rule", async () => {
		const { cwd } = setupRepo();

		const check = await checkRuleRequirements({ cwd, config: baseConfig });

		// the plain root manifest detects lightsout/node, which holds every rule its rules require
		expect({ id: check?.id, status: check?.status, namesOneGroup: /\b1\b/.test(check?.detail ?? '') }).toStrictEqual({
			id: 'rule-requirements',
			status: 'pass',
			namesOneGroup: true,
		});
	});

	test('warns naming the group, the pack and each missing requirement, joined with semicolons', async () => {
		const { cwd } = setupRepo();
		const config: LightsoutConfig = { ...baseConfig, 'standards-pack': 'lightsout/react' };

		const check = await checkRuleRequirements({ cwd, config });

		const entries = (check?.detail ?? '').split('; ');

		expect({
			id: check?.id,
			status: check?.status,
			hasFix: typeof check?.fix === 'string' && check.fix.length > 0,
			entryCount: entries.length,
			everyEntryNamesGroupAndPack: entries.every((entry) => entry.includes('repo root (outside packages)') && entry.includes('lightsout/react')),
			coveredRequirements: reactMissingRequirements.map(({ rule, required }) => entries.some((entry) => entry.includes(rule) && entry.includes(required))),
		}).toStrictEqual({
			id: 'rule-requirements',
			status: 'warn',
			hasFix: true,
			entryCount: 9,
			everyEntryNamesGroupAndPack: true,
			coveredRequirements: reactMissingRequirements.map(() => true),
		});
	});

	test('names a package group by its package folders and judges each group on its own pack', async () => {
		const { cwd, config } = setupMonorepo();

		const check = await checkRuleRequirements({ cwd, config });

		const entries = (check?.detail ?? '').split('; ');

		// the root group's lightsout/node sends every requirement, so every entry is the admin and web group's
		expect({
			id: check?.id,
			status: check?.status,
			entryCount: entries.length,
			everyEntryNamesBothPackages: entries.every((entry) => entry.includes('admin') && entry.includes('web') && entry.includes('lightsout/react')),
			anyEntryNamesRoot: entries.some((entry) => entry.includes('repo root (outside packages)')),
		}).toStrictEqual({ id: 'rule-requirements', status: 'warn', entryCount: 9, everyEntryNamesBothPackages: true, anyEntryNamesRoot: false });
	});

	test('judges requirements after standards-rule-settings apply', async () => {
		const { cwd } = setupRepo({ withHouseLibrary: true });
		const houseConfig: LightsoutConfig = {
			...baseConfig,
			'standards-libraries': { house: './standards/house' },
			'standards-pack': 'house/team',
		};
		const turnedOnConfig: LightsoutConfig = { ...houseConfig, 'standards-rule-settings': { 'house/b': 'advisory' } };

		const [publisherOff, turnedOn] = await Promise.all([
			checkRuleRequirements({ cwd, config: houseConfig }),
			checkRuleRequirements({ cwd, config: turnedOnConfig }),
		]);

		// b ships off, so a's requirement is missing until the repo turns b on
		expect({
			publisherOff: { id: publisherOff?.id, status: publisherOff?.status, namesB: (publisherOff?.detail ?? '').includes('house/b') },
			turnedOn: { id: turnedOn?.id, status: turnedOn?.status },
		}).toStrictEqual({
			publisherOff: { id: 'rule-requirements', status: 'warn', namesB: true },
			turnedOn: { id: 'rule-requirements', status: 'pass' },
		});
	});

	test('fails with the load error when the standards cannot be resolved', async () => {
		const { cwd } = setupRepo();
		const config: LightsoutConfig = { ...baseConfig, 'standards-pack': 'lightsout/no-such-pack' };
		const loadError = await getRejectionError({ promise: resolveStandardsGroups({ cwd, config, packages: undefined }) });

		const check = await checkRuleRequirements({ cwd, config });

		expect({
			id: check?.id,
			status: check?.status,
			carriesLoadError: (check?.detail ?? '').includes(loadError.message),
			hasFix: typeof check?.fix === 'string' && check.fix.length > 0,
		}).toStrictEqual({ id: 'rule-requirements', status: 'fail', carriesLoadError: true, hasFix: true });
	});
});
