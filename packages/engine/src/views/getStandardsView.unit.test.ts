import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { expect, test } from '@jest/globals';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { writeStandardsSnapshot } from '#src/standardsCheck/writeStandardsSnapshot.ts';
import { getStandardsView } from '#src/views/getStandardsView.ts';
import { seedRunDir } from '#tests/helpers/seedRunDir.ts';

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
			'rules/code/house/05-house-loose-file/check.ts':
				"export const check = {\n\tinputKinds: ['file-list'],\n\trun: ({ inputs }) => input.files.map((path) => ({ siteKey: `house-loose-file:${path}`, files: [{ path }], detail: 'loose' })),\n};\n",
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

test('a repo that has never run a check still describes what it enforces', async () => {
	const cwd = await seedStandardsRepo();
	const view = await getStandardsView({ cwd });

	// the view answers "what does this repo enforce?", not only "what is broken today"
	expect(view.at).toBe(undefined);
	expect(view.path).toBe('.');
	expect(view.findings).toStrictEqual([]);
	expect(view.notes).toStrictEqual([]);
	expect(view.trend).toStrictEqual([]);
	expect(view.rules.map((rule) => rule.rule)).toStrictEqual(['acme/house-loose-file', 'acme/house-name-things-well']);
	// a agent-only rule is listed beside the deterministic one
	expect(view.totals).toStrictEqual({ rules: 2, deterministic: 1, agent: 1, blocking: 0, advisory: 0, orphans: 0 });
});

test('a repo with no config at all is held to no standards', async () => {
	const cwd = await mkdtemp(join(tmpdir(), 'lightsout-view-bare-'));

	const view = await getStandardsView({ cwd });

	// standards are opt-in: a repo that has configured nothing names no pack, so no rule is listed
	expect(view.rules).toStrictEqual([]);
	expect(view.totals).toStrictEqual({ rules: 0, deterministic: 0, agent: 0, blocking: 0, advisory: 0, orphans: 0 });
	expect(view.at).toBe(undefined);
});

test('a rule row carries what the rule says, how this repo runs it, and how many findings it has open', async () => {
	const cwd = await seedStandardsRepo();

	await writeStandardsSnapshot({
		cwd,
		snapshot: {
			at: '2026-08-19T12:00:00.000Z',
			path: 'src',
			findings: [
				finding(),
				finding({ siteKey: 'acme/house-loose-file:src/other.ts' }),
				finding({ rule: 'acme/house-name-things-well', severity: StandardsSeverity.Advisory, siteKey: 'name:src/loose.ts' }),
			],
			notes: ['2 source file(s) scanned'],
		},
	});

	const view = await getStandardsView({ cwd });
	const [deterministic, agent] = view.rules;

	expect(view.at).toBe('2026-08-19T12:00:00.000Z');
	// a scoped snapshot says what it covered, so nobody reads it as the whole repo
	expect(view.path).toBe('src');
	expect(view.notes).toStrictEqual(['2 source file(s) scanned']);
	expect(deterministic).toStrictEqual({
		rule: 'acme/house-loose-file',
		doc: 'acme: code/house',
		documentPath: 'code/house',
		set: 'code',
		summary: 'a source file outside a module',
		prose: 'Every file belongs to a module.',
		deterministic: true,
		agent: false,
		severity: StandardsSeverity.Blocking,
		fromConfig: false,
		options: {},
		findingCount: 2,
		// no refactor run has met this rule yet
		history: { attempted: 0, resolved: 0, declined: 0, untracked: 0, adviceApplied: 0, adviceDeclined: 0, adviceAlreadyMet: 0, reasons: [] },
	});
	expect(agent?.findingCount).toBe(1);
	expect(agent?.deterministic).toBe(false);
	// the header's counts come from here, so no consumer ever tallies findings itself
	expect(view.totals).toStrictEqual({ rules: 2, deterministic: 1, agent: 1, blocking: 2, advisory: 1, orphans: 0 });
});

test('a finding whose rule no pack loads is counted as an orphan, and lands on no rule row', async () => {
	const cwd = await seedStandardsRepo();

	await writeStandardsSnapshot({
		cwd,
		snapshot: {
			at: '2026-08-19T12:00:00.000Z',
			path: '.',
			findings: [finding(), finding({ rule: 'rule-since-removed', siteKey: 'gone:src/loose.ts' })],
			notes: [],
		},
	});

	const view = await getStandardsView({ cwd });

	// a pack removed or renamed since the scan leaves findings nothing explains
	expect(view.totals.orphans).toBe(1);
	expect(view.rules.map((rule) => rule.findingCount)).toStrictEqual([1, 0]);
	// the finding is still reported — hiding it would be a number the reader cannot reconcile
	expect(view.findings.length).toBe(2);
});

test('findings are counted per full rule name and a short-named finding is an orphan', async () => {
	const cwd = await seedStandardsRepo({ pack: 'lightsout/standards' });

	await writeStandardsSnapshot({
		cwd,
		snapshot: {
			at: '2026-08-19T12:00:00.000Z',
			path: '.',
			findings: [
				finding({ rule: 'lightsout/function-size', siteKey: 'lightsout/function-size:src/loose.ts' }),
				finding({ rule: 'function-size', siteKey: 'function-size:src/other.ts' }),
			],
			notes: [],
		},
	});

	const view = await getStandardsView({ cwd });
	const row = view.rules.find((rule) => rule.rule === 'lightsout/function-size');

	// only the full name reaches the row; a bare short id is a finding nothing explains
	expect({ findingCount: row?.findingCount, orphans: view.totals.orphans }).toStrictEqual({ findingCount: 1, orphans: 1 });
});

test('a rule the config overrode says so, and carries the options this repo runs it at', async () => {
	const cwd = await seedStandardsRepo({ overrides: { 'house-loose-file': { severity: 'off', options: { 'max-lines': 400 } } } });
	const view = await getStandardsView({ cwd });

	expect(view.rules[0]?.severity).toBe(StandardsSeverity.Off);
	expect(view.rules[0]?.fromConfig).toBe(true);
	expect(view.rules[0]?.options).toStrictEqual({ 'max-lines': 400 });
	// the untouched rule keeps its own declaration — silence is never a change
	expect(view.rules[1]?.fromConfig).toBe(false);
});

/** A library whose house pack holds two agent-only rules that both declare default options in their rule.md headers. */
const writeOptionsPack = async () => {
	const packPath = await mkdtemp(join(tmpdir(), 'lightsout-view-options-'));

	await writeTree({
		dir: packPath,
		files: {
			'lightsout-standards.json': '{ "name": "acme", "formatVersion": 2 }\n',
			'packs/house.json': housePackFile,
			'rules/code/house/topic.md': '# House Style\n\nWhat this shop agrees on.\n',
			'rules/code/house/05-house-file-size/rule.md':
				'---\nsummary: a file over the house line cap\nchecks: agent\nseverity: advisory\noptions:\n  file: 250\n  tsxFile: 300\n---\n\nFiles stay short.\n',
			'rules/code/house/10-house-folder-size/rule.md':
				'---\nsummary: a folder over the house file cap\nchecks: agent\nseverity: advisory\noptions:\n  cap: 20\n---\n\nFolders stay small.\n',
		},
	});

	return packPath;
};

test('each rule row carries its resolved options', async () => {
	const cwd = await seedStandardsRepo({ library: await writeOptionsPack(), overrides: { 'house-file-size': { options: { tsxFile: 400 } } } });

	const view = await getStandardsView({ cwd });

	// the override merges key by key over the rule.md defaults, and the rule the config never names keeps its own
	expect(view.rules.map((rule) => ({ rule: rule.rule, options: rule.options, fromConfig: rule.fromConfig }))).toStrictEqual([
		{ rule: 'acme/house-file-size', options: { file: 250, tsxFile: 400 }, fromConfig: true },
		{ rule: 'acme/house-folder-size', options: { cap: 20 }, fromConfig: false },
	]);
});

test('refactor history is folded onto the rule whose sites a run attempted', async () => {
	const cwd = await seedStandardsRepo();
	const worklist = JSON.stringify({
		at: '2026-01-01T00:00:00.000Z',
		path: '.',
		all: false,
		batches: [{ id: 'batch-00:house-loose-file:src', rule: 'acme/house-loose-file', folder: 'src', blocking: [finding()], advisories: [] }],
	});

	await seedRunDir({
		cwd,
		manifest: {
			runId: 'run-refactor',
			pipeline: 'refactor',
			plan: '.lightsout/runs/run-refactor/worklist.json',
			steps: [{ id: 'batch-00:house-loose-file:src', status: 'passed', attempts: 1, report: { outcome: 'resolved', remainingSiteKeys: [], rationale: [] } }],
		},
		worklist,
	});

	const view = await getStandardsView({ cwd });

	// the site was frozen and is gone afterwards, so it counts as resolved
	expect(view.rules[0]?.history).toStrictEqual({
		attempted: 1,
		resolved: 1,
		declined: 0,
		untracked: 0,
		adviceApplied: 0,
		adviceDeclined: 0,
		adviceAlreadyMet: 0,
		reasons: [],
	});
});

test('the trend comes back oldest first, one point per check the user took', async () => {
	const cwd = await seedStandardsRepo();

	await writeStandardsSnapshot({ cwd, snapshot: { at: '2026-08-19T12:00:00.000Z', path: '.', findings: [finding(), finding({ siteKey: 'b' })], notes: [] } });
	await writeStandardsSnapshot({ cwd, snapshot: { at: '2026-08-20T12:00:00.000Z', path: '.', findings: [finding()], notes: [] } });

	const view = await getStandardsView({ cwd });

	// a chart plots it without re-sorting, and the latest snapshot is the last point
	expect(view.trend.map((point) => ({ at: point.at, total: point.total }))).toStrictEqual([
		{ at: '2026-08-19T12:00:00.000Z', total: 2 },
		{ at: '2026-08-20T12:00:00.000Z', total: 1 },
	]);
	expect(view.at).toBe('2026-08-20T12:00:00.000Z');
});

test('every history count and reason lands in its own column, on the rule it belongs to', async () => {
	const cwd = await seedStandardsRepo();
	const worklist = JSON.stringify({
		at: '2026-01-01T00:00:00.000Z',
		path: '.',
		all: false,
		batches: [
			{
				id: 'batch-00:house-loose-file:src',
				rule: 'acme/house-loose-file',
				folder: 'src',
				blocking: [finding({ siteKey: 'a' }), finding({ siteKey: 'b' }), finding({ siteKey: 'c' }), finding({ siteKey: 'd' })],
				advisories: [],
			},
			{
				id: 'batch-01:house-loose-file:lib',
				rule: 'acme/house-loose-file',
				folder: 'lib',
				blocking: [finding({ siteKey: 'e' }), finding({ siteKey: 'f' })],
				advisories: [],
			},
		],
	});

	await seedRunDir({
		cwd,
		manifest: {
			runId: 'run-refactor',
			pipeline: 'refactor',
			plan: '.lightsout/runs/run-refactor/worklist.json',
			steps: [
				{
					id: 'batch-00:house-loose-file:src',
					status: 'passed',
					attempts: 1,
					report: {
						outcome: 'declined',
						remainingSiteKeys: ['b', 'c', 'd'],
						rationale: ['the generated module is not ours to split'],
						advisoryOutcomes: [
							{ rule: 'acme/house-name-things-well', siteKey: 'name:a', outcome: 'applied' },
							{ rule: 'acme/house-name-things-well', siteKey: 'name:b', outcome: 'declined', reason: 'the name is a term of art here' },
							{ rule: 'acme/house-name-things-well', siteKey: 'name:c', outcome: 'declined', reason: 'renaming it would break the published API' },
						],
					},
				},
				{
					id: 'batch-01:house-loose-file:lib',
					status: 'passed',
					attempts: 1,
					report: { outcome: 'resolved', remainingSiteKeys: ['e', 'f'], rationale: [] },
				},
			],
		},
		worklist,
	});

	const view = await getStandardsView({ cwd });

	// six sites frozen: one gone, three the agent declined and said why, and two
	// a batch that called itself resolved left standing without an account
	expect(view.rules[0]?.history).toStrictEqual({
		attempted: 6,
		resolved: 1,
		declined: 3,
		untracked: 2,
		adviceApplied: 0,
		adviceDeclined: 0,
		adviceAlreadyMet: 0,
		reasons: ['the generated module is not ours to split'],
	});
	// advice is recorded against the rule that gave it, never the rule the batch was working
	expect(view.rules[1]?.history).toStrictEqual({
		attempted: 0,
		resolved: 0,
		declined: 0,
		untracked: 0,
		adviceApplied: 1,
		adviceDeclined: 2,
		adviceAlreadyMet: 0,
		reasons: ['the name is a term of art here', 'renaming it would break the published API'],
	});
});

test('a repo that declares no standards packs still reports the findings its last check left', async () => {
	const cwd = await seedStandardsRepo({ pack: false });

	await writeStandardsSnapshot({
		cwd,
		snapshot: {
			at: '2026-08-19T12:00:00.000Z',
			path: '.',
			findings: [finding(), finding({ rule: 'acme/house-name-things-well', severity: StandardsSeverity.Advisory, siteKey: 'name:src/loose.ts' })],
			notes: [],
		},
	});

	const view = await getStandardsView({ cwd });

	// nothing states the rules any more, so every finding is one nothing explains
	expect(view.rules).toStrictEqual([]);
	expect(view.totals).toStrictEqual({ rules: 0, deterministic: 0, agent: 0, blocking: 1, advisory: 1, orphans: 2 });
	expect(view.findings.map((entry) => entry.siteKey)).toStrictEqual(['acme/house-loose-file:src/loose.ts', 'name:src/loose.ts']);
});

/** A repo whose root depends on React but whose config selects the fractal pack alone, by name. */
const seedSelectedPackRepo = async () => {
	const cwd = await mkdtemp(join(tmpdir(), 'lightsout-view-selected-pack-'));

	await writeTree({
		dir: cwd,
		files: {
			'package.json': JSON.stringify({ name: 'app', dependencies: { react: '^19.0.0' } }),
			'lightsout.config.json': JSON.stringify({
				gates: { check: 'true', test: 'true', 'test-coverage': false },
				'standards-pack': 'lightsout/fractal',
			}),
		},
	});

	return cwd;
};

test('getStandardsView: rows follow the selected pack', async () => {
	const cwd = await seedSelectedPackRepo();

	const view = await getStandardsView({ cwd });
	const names = view.rules.map((rule) => rule.rule);

	// a fractal rule gets its row; a React architecture rule the library holds but the fractal pack leaves out gets none
	expect({
		hasFractalRule: names.includes('lightsout/function-size'),
		hasReactRule: names.includes('lightsout/component-file-structure'),
		reactTopicRows: view.rules.filter((rule) => rule.documentPath === 'code/frameworks/react').length,
	}).toStrictEqual({ hasFractalRule: true, hasReactRule: false, reactTopicRows: 0 });
});

test('a declared standards pack that cannot be loaded fails the view rather than describing half a repo', async () => {
	const cwd = await seedStandardsRepo({ library: './standards-that-were-never-installed' });

	await expect(getStandardsView({ cwd })).rejects.toThrow(/standards library acme \(\.\/standards-that-were-never-installed\) will not load/);
});

test('a config naming a rule no pack declares fails the view', async () => {
	const cwd = await seedStandardsRepo({ overrides: { 'house-loose-flie': 'off' } });

	// the typo is caught where the valid ids are known, not silently ignored
	await expect(getStandardsView({ cwd })).rejects.toThrow(/standards-rule-settings names "house-loose-flie": no rule is named/);
});

/**
 * A monorepo whose root and engine run the acme house pack while web-app runs a
 * relaxed pack that brings in the same house topic with its checked rule
 * graded advisory, so the rule list holds that rule at two states.
 */
const seedSplitRuleRepo = async () => {
	const library = await writeStandardsPack();
	const cwd = await mkdtemp(join(tmpdir(), 'lightsout-view-split-rule-'));

	await writeTree({
		dir: library,
		files: {
			'packs/relaxed.json': JSON.stringify({
				description: 'the house pack with loose files tolerated',
				include: { packs: ['acme/house'] },
				'rule-settings': { 'house-loose-file': 'advisory' },
			}),
		},
	});
	await writeTree({
		dir: cwd,
		files: {
			'package.json': JSON.stringify({ name: 'repo' }),
			'packages/engine/package.json': JSON.stringify({ name: 'engine' }),
			'packages/web-app/package.json': JSON.stringify({ name: 'web-app' }),
			'lightsout.config.json': JSON.stringify({
				gates: { check: 'true', test: 'true', 'test-coverage': false },
				'standards-libraries': { acme: library },
				'standards-pack': 'acme/house',
				'package-standards-packs': { 'web-app': 'acme/relaxed' },
			}),
		},
	});

	return cwd;
};

test('keeps one row per rule when the rule list splits a rule across package groups', async () => {
	const cwd = await seedSplitRuleRepo();

	const view = await getStandardsView({ cwd });

	// the root and engine hold the rule at blocking, the widest listing, so the one row takes that state
	expect({
		rows: view.rules.map((rule) => ({ rule: rule.rule, severity: rule.severity })),
		totals: view.totals,
	}).toStrictEqual({
		rows: [
			{ rule: 'acme/house-loose-file', severity: StandardsSeverity.Blocking },
			{ rule: 'acme/house-name-things-well', severity: StandardsSeverity.Advisory },
		],
		totals: { rules: 2, deterministic: 1, agent: 1, blocking: 0, advisory: 0, orphans: 0 },
	});
});
