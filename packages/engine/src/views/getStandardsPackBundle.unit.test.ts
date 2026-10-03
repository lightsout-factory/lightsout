/**
 * @jest-environment node
 */
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { FixtureSide } from '#src/contracts/views/FixtureSide.ts';
import { StandardsPackBundle } from '#src/contracts/views/StandardsPackBundle.ts';
import { getStandardsPackBundle } from '#src/views/getStandardsPackBundle.ts';
import { getRejectionError } from '#tests/helpers/getRejectionError.ts';

/** Write a set of repo-relative files, creating the folders they need. */
const writeTree = async ({ dir, files }: { dir: string; files: Record<string, string> }) => {
	for (const [path, content] of Object.entries(files)) {
		await mkdir(dirname(join(dir, path)), { recursive: true });
		await writeFile(join(dir, path), content, 'utf8');
	}
};

/**
 * This monorepo, whose config names no standards pack — so the pack read from it
 * is the authored default one, fixtures and all, which is the read
 * `assets/default-pack.json` is built from. Anchored on this file rather than on
 * the working directory, which depends on where the runner was invoked from.
 */
const setupThisRepo = () => ({ cwd: join(__dirname, '..', '..', '..', '..') });

/**
 * The check the `zebra-check` rule ships, written as a library author writes
 * one: a `check` export naming its input kind and one finding per file.
 */
const zebraCheckSource =
	'export const check = {\n' +
	"\tinputKinds: ['file-list'],\n" +
	'\trun: ({ inputs }) => inputs["file-list"].files.map((path) => ({ siteKey: `zebra-check:${path}`, files: [{ path }], detail: `${path} is striped` })),\n' +
	'};\n';

/**
 * A temp library `house`, pointed at by LIGHTSOUT_DEFAULT_STANDARDS, with two
 * topics and two pack files: `base` brings in `code/alpha`, and `app` includes
 * `base` plus `tests/beta` and grades `zebra-check` blocking with `cap` raised.
 * `baseAppliesWhen` makes `base` conditional on those dependencies.
 *
 * Every file is written in reverse name order — packs, topics, rule folders
 * and fixture files — and the rule ids run against their folder order, so any
 * order the bundle reports is one it decided, not one the disk handed back.
 * The environment is replaced outright; restoreMocks puts the real one back.
 */
const setupLibraryRepo = async ({ appPacks = ['house/base'], baseAppliesWhen }: { appPacks?: string[]; baseAppliesWhen?: string[] } = {}) => {
	const libraryPath = await mkdtemp(join(tmpdir(), 'lightsout-pack-bundle-library-'));
	const cwd = await mkdtemp(join(tmpdir(), 'lightsout-pack-bundle-repo-'));

	await writeTree({
		dir: libraryPath,
		files: {
			'lightsout-standards.json': JSON.stringify({ name: 'house', formatVersion: 2 }),
			'packs/base.json': JSON.stringify({
				description: 'The base pack.',
				include: { topics: ['house/code/alpha'] },
				...(baseAppliesWhen === undefined ? {} : { 'applies-when': { dependencies: baseAppliesWhen } }),
			}),
			'packs/app.json': JSON.stringify({
				description: 'The app pack.',
				include: { packs: appPacks, topics: ['house/tests/beta'] },
				'rule-settings': { 'house/zebra-check': { severity: 'blocking', options: { cap: 9 } } },
			}),
			'rules/tests/beta/topic.md': '# Beta\n\nWhat the beta rules share.\n',
			'rules/tests/beta/10-mango-note/rule.md': '---\nsummary: a agent-checked rule about tests\nchecks: agent\n---\n\nTests read as prose.\n',
			'rules/code/alpha/topic.md': '# Alpha\n\nWhat the alpha rules share.\n',
			'rules/code/alpha/20-apple-note/rule.md': '---\nsummary: a agent-checked rule about code\nchecks: agent\n---\n\nCode reads as prose.\n',
			'rules/code/alpha/10-zebra-check/rule.md':
				'---\nsummary: a checked rule\nchecks: deterministic\nseverity: advisory\noptions:\n  cap: 5\n  width: 2\n---\n\nStripes are checked.\n',
			'rules/code/alpha/10-zebra-check/check.ts': zebraCheckSource,
			'rules/code/alpha/10-zebra-check/fixtures/fail/src/loose.ts': 'export const loose = 1;\n',
			'rules/code/alpha/10-zebra-check/fixtures/pass/src/b.ts': 'export const b = 1;\n',
			'rules/code/alpha/10-zebra-check/fixtures/pass/src/a.ts': 'export const a = 1;\n',
		},
	});
	jest.replaceProperty(process, 'env', { ...process.env, LIGHTSOUT_DEFAULT_STANDARDS: libraryPath });

	return { cwd };
};

describe('getStandardsPackBundle', () => {
	test('reads the pack whole — every rule with its prose and the text of its fixtures', async () => {
		const { cwd } = await setupLibraryRepo();

		const bundle = await getStandardsPackBundle({ cwd });
		const rule = bundle.rules.find((entry) => entry.id === 'zebra-check');

		expect(rule?.prose).toContain('Stripes are checked.');
		expect(rule?.fixtures.map((fixture) => fixture.text)).toContain('export const loose = 1;\n');
	});

	test('states the order of its documents rather than leaving it to whichever filesystem it ran on', async () => {
		const { cwd } = await setupLibraryRepo();

		const bundle = await getStandardsPackBundle({ cwd });

		expect(bundle.topics.map((topic) => topic.path)).toStrictEqual(['code/alpha', 'tests/beta']);
	});

	test('states the order of its rules as their ids, not as their folders were walked', async () => {
		const { cwd } = await setupLibraryRepo();

		const bundle = await getStandardsPackBundle({ cwd });

		expect(bundle.rules.map((rule) => rule.id)).toStrictEqual(['apple-note', 'mango-note', 'zebra-check']);
	});

	test('carries the numbers each rule.md declares under options as its default options, and none for a rule that declares no options', async () => {
		const { cwd } = await setupLibraryRepo();

		const bundle = await getStandardsPackBundle({ cwd });
		const defaultOptionsById = Object.fromEntries(bundle.rules.map((rule) => [rule.id, rule.defaultOptions]));

		expect(defaultOptionsById).toStrictEqual({
			'apple-note': {},
			'mango-note': {},
			'zebra-check': { cap: 5, width: 2 },
		});
	});

	test('keeps a rule’s proof in reading order — what the rule wants first, what it catches second', async () => {
		const { cwd } = await setupLibraryRepo();

		const bundle = await getStandardsPackBundle({ cwd });
		const rule = bundle.rules.find((entry) => entry.id === 'zebra-check');

		expect(rule?.fixtures.map((fixture) => [fixture.side, fixture.path])).toStrictEqual([
			[FixtureSide.Pass, 'src/a.ts'],
			[FixtureSide.Pass, 'src/b.ts'],
			[FixtureSide.Fail, 'src/loose.ts'],
		]);
	});

	test('reads the authored default pack a repo loads when its config names none, carrying the proof the shipped copy leaves out', async () => {
		const { cwd } = setupThisRepo();

		const bundle = await getStandardsPackBundle({ cwd });
		const rule = bundle.rules.find((entry) => entry.id === 'type-assertion');

		// the read `assets/default-pack.json` is built from. The copy the engine
		// ships is `built` and carries no fixtures at all, so a bundle that came
		// back with an empty proof would commit a pack the public build cannot
		// argue from — while still parsing and still passing every other test here.
		expect({ built: bundle.built, fixtures: rule?.fixtures.map((fixture) => [fixture.side, fixture.path]) }).toStrictEqual({
			built: false,
			fixtures: [
				[FixtureSide.Pass, 'src/payloads/common/constants/PayloadKind.ts'],
				[FixtureSide.Pass, 'src/payloads/readLabel.ts'],
				[FixtureSide.Fail, 'src/payloads/readLabel.ts'],
			],
		});
	});

	test('lists every pack file of the library with its include lists and the rules and topics it resolves to', async () => {
		const { cwd } = await setupLibraryRepo();

		const bundle = await getStandardsPackBundle({ cwd });
		const packs = bundle.packs.map((pack) => ({
			name: pack.name,
			address: pack.address,
			description: pack.description,
			include: pack.include,
			topics: pack.topics,
			rules: pack.rules.map((rule) => rule.name),
		}));

		expect(packs).toStrictEqual([
			{
				name: 'app',
				address: 'house/app',
				description: 'The app pack.',
				include: { packs: ['house/base'], topics: ['house/tests/beta'], rules: [] },
				topics: ['house/code/alpha', 'house/tests/beta'],
				rules: ['house/apple-note', 'house/mango-note', 'house/zebra-check'],
			},
			{
				name: 'base',
				address: 'house/base',
				description: 'The base pack.',
				include: { packs: [], topics: ['house/code/alpha'], rules: [] },
				topics: ['house/code/alpha'],
				rules: ['house/apple-note', 'house/zebra-check'],
			},
		]);
	});

	test('lists a conditional pack, and a pack including it, with everything the conditional pack brings when it applies', async () => {
		const { cwd } = await setupLibraryRepo({ baseAppliesWhen: ['react'] });

		const bundle = await getStandardsPackBundle({ cwd });
		const rulesByPack = Object.fromEntries(bundle.packs.map((pack) => [pack.name, pack.rules.map((rule) => rule.name)]));

		// a pack page shows the whole pack: no package's dependencies are consulted, so the condition empties nothing
		expect(rulesByPack).toStrictEqual({
			app: ['house/apple-note', 'house/mango-note', 'house/zebra-check'],
			base: ['house/apple-note', 'house/zebra-check'],
		});
	});

	test('says which dependencies a conditional pack waits for, and nothing on a pack that applies everywhere', async () => {
		const { cwd } = await setupLibraryRepo({ baseAppliesWhen: ['react', 'preact'] });

		const bundle = await getStandardsPackBundle({ cwd });
		const conditions = bundle.packs.map((pack) => ({ name: pack.name, conditional: 'appliesWhen' in pack, appliesWhen: pack.appliesWhen }));

		// `app` includes the conditional pack but is not conditional itself
		expect(conditions).toStrictEqual([
			{ name: 'app', conditional: false, appliesWhen: undefined },
			{ name: 'base', conditional: true, appliesWhen: { dependencies: ['react', 'preact'] } },
		]);
	});

	test("records a pack's own severity and options on its rule entries without changing the rule's defaults", async () => {
		const { cwd } = await setupLibraryRepo();

		const bundle = await getStandardsPackBundle({ cwd });
		const appEntry = bundle.packs.find((pack) => pack.name === 'app')?.rules.find((rule) => rule.name === 'house/zebra-check');
		const baseEntry = bundle.packs.find((pack) => pack.name === 'base')?.rules.find((rule) => rule.name === 'house/zebra-check');
		const row = bundle.rules.find((rule) => rule.id === 'zebra-check');

		expect({
			app: appEntry,
			base: baseEntry,
			row: { defaultSeverity: row?.defaultSeverity, defaultOptions: row?.defaultOptions },
		}).toStrictEqual({
			app: { name: 'house/zebra-check', severity: 'blocking', options: { cap: 9, width: 2 } },
			base: { name: 'house/zebra-check', severity: 'advisory', options: { cap: 5, width: 2 } },
			row: { defaultSeverity: 'advisory', defaultOptions: { cap: 5, width: 2 } },
		});
	});

	test('totals each pack and the library from what each holds', async () => {
		const { cwd } = await setupLibraryRepo();

		const bundle = await getStandardsPackBundle({ cwd });
		const totals = {
			library: bundle.totals,
			packs: Object.fromEntries(bundle.packs.map((pack) => [pack.name, pack.totals])),
		};

		expect(totals).toStrictEqual({
			library: { rules: 3, deterministic: 1, agent: 2, topics: 2, packs: 2, withFixtures: 1 },
			packs: {
				app: { rules: 3, deterministic: 1, agent: 2, topics: 2 },
				base: { rules: 2, deterministic: 1, agent: 1, topics: 1 },
			},
		});
	});

	test('carries full rule names and no channel on any rule, topic or pack', async () => {
		const { cwd } = await setupLibraryRepo();

		const bundle = await getStandardsPackBundle({ cwd });
		const rows: object[] = [...bundle.rules, ...bundle.topics, ...bundle.packs];

		expect({
			names: bundle.rules.map((rule) => [rule.id, rule.name]),
			topicKeys: bundle.topics.map((topic) => Object.keys(topic).sort()),
			withChannel: rows.filter((row) => Object.hasOwn(row, 'channel') || Object.hasOwn(row, 'channels')),
		}).toStrictEqual({
			names: [
				['apple-note', 'house/apple-note'],
				['mango-note', 'house/mango-note'],
				['zebra-check', 'house/zebra-check'],
			],
			topicKeys: [
				['intro', 'path', 'ruleIds', 'set'],
				['intro', 'path', 'ruleIds', 'set'],
			],
			withChannel: [],
		});
	});

	test('orders packs, topics, rules and fixtures the same way whatever order the disk returns', async () => {
		const { cwd } = await setupLibraryRepo();

		const bundle = await getStandardsPackBundle({ cwd });
		const order = {
			packs: bundle.packs.map((pack) => pack.name),
			topics: bundle.topics.map((topic) => topic.path),
			rules: bundle.rules.map((rule) => rule.id),
			fixtures: bundle.rules.find((rule) => rule.id === 'zebra-check')?.fixtures.map((fixture) => [fixture.side, fixture.path]),
		};

		expect(order).toStrictEqual({
			packs: ['app', 'base'],
			topics: ['code/alpha', 'tests/beta'],
			rules: ['apple-note', 'mango-note', 'zebra-check'],
			fixtures: [
				[FixtureSide.Pass, 'src/a.ts'],
				[FixtureSide.Pass, 'src/b.ts'],
				[FixtureSide.Fail, 'src/loose.ts'],
			],
		});
	});

	test('builds a bundle the StandardsPackBundle contract takes back unchanged, so no stray field reaches the committed asset', async () => {
		const { cwd } = await setupLibraryRepo();

		const bundle = await getStandardsPackBundle({ cwd });
		const parsed = StandardsPackBundle.parse(bundle);

		expect(parsed).toStrictEqual(bundle);
	});

	test('rejects when a pack file names a library the bundle cannot see', async () => {
		const { cwd } = await setupLibraryRepo({ appPacks: ['house/base', 'acme/shared'] });

		const error = await getRejectionError({ promise: getStandardsPackBundle({ cwd }) });

		expect(error.message).toMatch(/house\/app[\s\S]*acme/);
	});

	test('bundles the authored lightsout library with its five packs', async () => {
		const { cwd } = setupThisRepo();

		const bundle = await getStandardsPackBundle({ cwd });
		const documentPathByName = new Map(bundle.rules.map((rule) => [rule.name, rule.documentPath]));
		const standards = bundle.packs.find((pack) => pack.address === 'lightsout/standards');
		const standardsTopics = new Set(standards?.rules.map((rule) => documentPathByName.get(rule.name)));

		expect({
			name: bundle.name,
			built: bundle.built,
			packs: bundle.packs.map((pack) => pack.name),
			holdsReact: standardsTopics.has('tests/frameworks/react'),
			holdsTanstackStart: standardsTopics.has('code/frameworks/tanstack-start'),
		}).toStrictEqual({
			name: 'lightsout',
			built: false,
			packs: ['code-style', 'fractal', 'react', 'standards', 'tanstack-start'],
			holdsReact: true,
			holdsTanstackStart: true,
		});
	});
});
