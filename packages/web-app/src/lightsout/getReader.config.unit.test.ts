/**
 * @jest-environment node
 */
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, test } from '@jest/globals';
import { ConfigNotFoundError } from '@lightsout/engine';
import type { LightsoutReader } from '#src/lightsout/common/types/LightsoutReader.ts';
import { getReader } from '#src/lightsout/getReader.ts';

/** The config this arrangement writes, as text — what a test overriding it writes its own version of. */
const configText = JSON.stringify({
	harness: 'claude-code',
	gates: { check: 'true', test: 'true', 'test-coverage': false },
	'standards-libraries': { acme: './house' },
	'standards-pack': 'acme/house',
	'standards-rule-settings': { 'house-name-things-well': 'off' },
});

/** A house library of two rules, one blocking by its own front matter and one taking the advisory default, with a pack bringing in its one topic. */
const packFiles: Record<string, string> = {
	'house/lightsout-standards.json': JSON.stringify({ name: 'acme', formatVersion: 2, description: 'what this shop agrees on' }),
	'house/rules/code/house/topic.md': '# House Style\n\nWhat this shop agrees on.\n',
	'house/rules/code/house/05-house-loose-file/rule.md':
		'---\nsummary: a source file outside a module\nseverity: blocking\n---\n\nEvery file belongs to a module.\n',
	'house/rules/code/house/10-house-name-things-well/rule.md': '---\nsummary: a name that hides what it does\n---\n\nNames are the cheapest documentation.\n',
	'house/packs/house.json': JSON.stringify({ description: 'what this shop agrees on', include: { topics: ['acme/code/house'] } }),
};

/**
 * A repo of somebody's own: a config that states a harness, registers a
 * library, selects its pack and turns one of that pack's rules off, pointed at
 * through `LIGHTSOUT_REPO`.
 *
 * A repo with its own library rather than the built-in one, because what the
 * ledger has to get right is which library defines each rule — a question only
 * a repo registering its own library can answer wrongly.
 */
const setupConfigReader = async ({ config = configText }: { config?: string } = {}): Promise<{ reader: LightsoutReader; repoRoot: string }> => {
	const repoRoot = await mkdtemp(join(tmpdir(), 'lightsout-reader-config-'));

	for (const [path, content] of Object.entries({ 'lightsout.config.json': config, ...packFiles })) {
		await mkdir(dirname(join(repoRoot, path)), { recursive: true });
		await writeFile(join(repoRoot, path), content, 'utf8');
	}

	process.env.LIGHTSOUT_REPO = repoRoot;

	return { reader: getReader(), repoRoot };
};

/**
 * A directory with no `lightsout.config.json` in it at all.
 *
 * A separate arrangement rather than a parameter, because the absence of the
 * file is a different fact from its contents: it is the one the page turns into
 * a 404 rather than into a message.
 */
const setupUnconfiguredRepo = async (): Promise<{ reader: LightsoutReader }> => {
	const repoRoot = await mkdtemp(join(tmpdir(), 'lightsout-reader-unconfigured-'));

	process.env.LIGHTSOUT_REPO = repoRoot;

	return { reader: getReader() };
};

/** A config that registers the house library as `acme` and selects its one pack by name. */
const selectedPackConfigText = JSON.stringify({
	harness: 'claude-code',
	gates: { check: 'true', test: 'true', 'test-coverage': false },
	'standards-libraries': { acme: './house' },
	'standards-pack': 'acme/house',
	'standards-rule-settings': { 'house-name-things-well': 'off' },
});

/**
 * The house library registered under its own name, with a pack file that
 * brings in its one topic, and a config selecting that pack.
 *
 * A separate arrangement rather than a parameter, because selecting a pack
 * needs a file in the library's `packs/` folder as well as a different config.
 */
const setupSelectedPackReader = async (): Promise<{ reader: LightsoutReader }> => {
	const { reader, repoRoot } = await setupConfigReader({ config: selectedPackConfigText });
	const packPath = join(repoRoot, 'house', 'packs', 'house.json');

	await mkdir(dirname(packPath), { recursive: true });
	await writeFile(packPath, JSON.stringify({ description: 'what this shop agrees on', include: { topics: ['acme/code/house'] } }), 'utf8');

	return { reader };
};

afterEach(() => {
	delete process.env.LIGHTSOUT_REPO;
});

describe('getReader config', () => {
	test('answers with the config file of the repo it was pointed at, at the path it was read from', async () => {
		const { reader, repoRoot } = await setupConfigReader();

		const view = await reader.getConfig();

		expect({ path: view.path, harness: view.harness, model: view.model }).toStrictEqual({
			path: join(repoRoot, 'lightsout.config.json'),
			harness: 'claude-code',
			model: null,
		});
	});

	test('groups every live key into the areas the page reads, in order', async () => {
		const { reader } = await setupConfigReader();

		const view = await reader.getConfig();

		expect(view.sections.map((section) => ({ title: section.title, keys: section.fields.map((field) => field.key) }))).toStrictEqual([
			{ title: 'Harness', keys: ['harness', 'model', 'effort', 'permissions', 'commands'] },
			{ title: 'Gates', keys: ['gates', 'package-gates', 'gate-overrides', 'packages-dir', 'coverage-summary-path', 'executor-file-limit'] },
			{ title: 'Standards', keys: ['standards-pack', 'package-standards-packs', 'standards-libraries', 'standards-rule-settings'] },
			{ title: 'Agent commands', keys: ['agent-commands'] },
			{ title: 'Generated', keys: ['generated', 'vendored'] },
			{ title: 'Timeouts', keys: ['timeouts.agent-minutes', 'timeouts.supervisor-minutes', 'timeouts.gate-minutes'] },
			{ title: 'Ship', keys: ['ship'] },
			{ title: 'Ticket tracker', keys: ['ticket-tracker'] },
			{ title: 'Worktree', keys: ['worktree'] },
			{ title: 'Queue', keys: ['queue'] },
			{ title: 'Auto plan', keys: ['auto-plan'] },
			{ title: 'Plan', keys: ['plan'] },
			{ title: 'Implement', keys: ['implement'] },
			{ title: 'Pricing', keys: ['pricing'] },
			{ title: 'Docs', keys: ['docs'] },
		]);
	});

	test('lists standards-libraries in the Standards area beside the pack keys', async () => {
		const { reader } = await setupConfigReader();

		const view = await reader.getConfig();

		expect(view.sections.find((section) => section.title === 'Standards')?.fields.map((field) => field.key)).toStrictEqual([
			'standards-pack',
			'package-standards-packs',
			'standards-libraries',
			'standards-rule-settings',
		]);
	});

	test('says of each value whether the file set it or lightsout filled it in', async () => {
		const { reader } = await setupConfigReader();

		const view = await reader.getConfig();

		expect(view.sections.flatMap((section) => section.fields).map(({ key, value, fromConfig }) => ({ key, value, fromConfig }))).toEqual(
			expect.arrayContaining([
				{ key: 'gates', value: { check: 'true', test: 'true', 'test-coverage': false }, fromConfig: true },
				{ key: 'packages-dir', value: 'packages', fromConfig: false },
				{ key: 'coverage-summary-path', value: 'coverage/coverage-summary.json', fromConfig: false },
				{ key: 'executor-file-limit', value: 50, fromConfig: false },
				{ key: 'timeouts.agent-minutes', value: 60, fromConfig: false },
				{ key: 'timeouts.supervisor-minutes', value: 15, fromConfig: false },
				{ key: 'commands', value: null, fromConfig: false },
			]),
		);
	});

	test('gives every field the description its key carries, so the page states no wording of its own', async () => {
		const { reader } = await setupConfigReader();

		const view = await reader.getConfig();

		expect(view.sections.flatMap((section) => section.fields).every((field) => field.description.length > 0)).toBe(true);
	});

	test('carries every loaded rule with the pack that declares it, its severity here, and who decided that', async () => {
		const { reader } = await setupConfigReader();

		const view = await reader.getConfig();

		expect(view.ruleStates).toStrictEqual([
			{
				rule: 'acme/house-loose-file',
				id: 'house-loose-file',
				library: 'acme',
				severity: 'blocking',
				fromConfig: false,
				options: {},
				packages: [''],
				appliesTo: 'repo root (outside packages)',
			},
			{
				rule: 'acme/house-name-things-well',
				id: 'house-name-things-well',
				library: 'acme',
				severity: 'off',
				fromConfig: true,
				options: {},
				packages: [''],
				appliesTo: 'repo root (outside packages)',
			},
		]);
	});

	test('rejects with the typed not-found error for a repo holding no config file, which is the page’s 404', async () => {
		const { reader } = await setupUnconfiguredRepo();

		await expect(reader.getConfig()).rejects.toThrow(ConfigNotFoundError);
	});

	test('rejects with the parse failure itself for a config that will not parse, since that message is the actionable answer', async () => {
		const { reader } = await setupConfigReader({ config: '{ "gates": ' });

		await expect(reader.getConfig()).rejects.toThrow(/is not valid JSON/);
	});

	test('carries the pack group the config selects, and says it was named', async () => {
		const { reader } = await setupSelectedPackReader();

		const view = await reader.getConfig();

		expect({ standardsGroups: view.standardsGroups, carriesChannels: Object.hasOwn(view, 'channels') }).toStrictEqual({
			standardsGroups: [{ packages: [''], appliesTo: 'repo root (outside packages)', pack: 'acme/house', conditionalPacks: [] }],
			carriesChannels: false,
		});
	});

	test('lists only standards-pack, package-standards-packs, standards-libraries and standards-rule-settings in the Standards area', async () => {
		const { reader } = await setupSelectedPackReader();

		const view = await reader.getConfig();

		expect(view.sections.find((section) => section.title === 'Standards')?.fields.map((field) => field.key)).toStrictEqual([
			'standards-pack',
			'package-standards-packs',
			'standards-libraries',
			'standards-rule-settings',
		]);
	});
});
