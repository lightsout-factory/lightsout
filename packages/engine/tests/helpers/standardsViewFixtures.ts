import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';

/** Write a set of pack-relative files, creating the folders they need. */
const writeTree = async ({ dir, files }: { dir: string; files: Record<string, string> }) => {
	for (const [rel, content] of Object.entries(files)) {
		await mkdir(dirname(join(dir, rel)), { recursive: true });
		await writeFile(join(dir, rel), content, 'utf8');
	}
};

/** The pack file that selects the house topic whole, which every library below ships as its `house` pack. */
const housePackFile = JSON.stringify({ description: 'what this shop agrees on', include: { topics: ['acme/code/house'] } });

/** A standards library of somebody's own, whose house pack holds one deterministic rule and one agent-only rule. */
const writeStandardsPack = async () => {
	const packPath = await mkdtemp(join(tmpdir(), 'lightsout-view-standards-'));

	await writeTree({
		dir: packPath,
		files: {
			'lightsout-standards.json': '{ "name": "acme", "formatVersion": 2 }\n',
			'packs/house.json': housePackFile,
			'rules/code/house/topic.md': '# House Style\n\nWhat this shop agrees on.\n',
			'rules/code/house/05-house-loose-file/rule.md':
				'---\nsummary: a source file outside a module\nchecks: deterministic\nseverity: blocking\n---\n\nEvery file belongs to a module.\n',
			'rules/code/house/05-house-loose-file/check.ts': `export const check = {\n\tinputKinds: ['file-list'],\n\trun: ({ inputs }) => input.files.map((path) => ({ siteKey: \`house-loose-file:\${path}\`, files: [{ path }], detail: 'loose' })),\n};\n`,
			'rules/code/house/05-house-loose-file/fixtures/pass/src/mod/index.ts': 'export const mod = 1;\n',
			'rules/code/house/05-house-loose-file/fixtures/fail/src/loose.ts': 'export const loose = 1;\n',
			'rules/code/house/10-house-name-things-well/rule.md':
				'---\nsummary: a name that hides what it does\nchecks: agent\nseverity: advisory\n---\n\nNames are the cheapest documentation.\n',
		},
	});

	return packPath;
};

/** A repo that registers that library as acme and selects its house pack, optionally overriding one rule's state in its own config. */
const seedStandardsRepo = async ({
	overrides,
	library,
	pack = 'acme/house',
}: {
	overrides?: Record<string, unknown>;
	library?: string;
	pack?: string | false;
} = {}) => {
	const cwd = await mkdtemp(join(tmpdir(), 'lightsout-view-repo-'));

	await writeTree({
		dir: cwd,
		files: {
			'src/loose.ts': 'export const loose = 1;\n',
			'lightsout.config.json': JSON.stringify({
				gates: { check: 'true', test: 'true', 'test-coverage': false },
				'standards-libraries': { acme: library ?? (await writeStandardsPack()) },
				'standards-pack': pack,
				...(overrides ? { 'standards-rule-settings': overrides } : {}),
			}),
		},
	});

	return cwd;
};

const finding = (overrides: Partial<StandardsFinding> = {}): StandardsFinding => ({
	rule: 'acme/house-loose-file',
	severity: StandardsSeverity.Blocking,
	siteKey: 'acme/house-loose-file:src/loose.ts',
	files: [{ path: 'src/loose.ts' }],
	detail: 'loose',
	...overrides,
});

/**
 * The acme library, the repo that registers it and the findings a check of that
 * repo leaves, as one vocabulary every `getStandardsView` test file reads from.
 *
 * One copy rather than one per test file, so two files cannot disagree about
 * which rules the house pack holds or what a finding against it looks like.
 */
export const standardsViewFixtures = { writeTree, housePackFile, writeStandardsPack, seedStandardsRepo, finding };
