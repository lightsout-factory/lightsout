import { mkdirSync, writeFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import type { ConfigView } from '#src/contracts/views/config/ConfigView.ts';
import { ConfigNotFoundError } from '#src/views/ConfigNotFoundError.ts';
import { getConfigView } from '#src/views/getConfigView.ts';
import { freshCwd } from '#tests/helpers/freshCwd.ts';
import { seedConfiguredCwd } from '#tests/helpers/seedConfiguredCwd.ts';

/** This repo's own root — the config the view is read against, so the assertions describe a real file rather than a fixture of one. */
const repoRoot = join(__dirname, '..', '..', '..', '..');

/** A directory this repo has, with no config in it — what "no config here" looks like without reaching outside the checkout. */
const withoutConfig = join(repoRoot, 'packages');

/** One row out of the grouped sections, by the key the file would spell. */
const findField = ({ sections, key }: { sections: ConfigView['sections']; key: string }) =>
	sections.flatMap((section) => section.fields).find((field) => field.key === key);

/**
 * A repo whose config text is the case itself — a file the schema will refuse,
 * which `seedConfiguredCwd` cannot write because it only serialises valid
 * objects.
 */
const setupRawConfig = async ({ raw }: { raw: string }) => {
	const cwd = await freshCwd();

	await writeFile(join(cwd, 'lightsout.config.json'), raw, 'utf8');

	return { cwd };
};

/**
 * A repo that registers a standards library of its own and selects its house
 * pack, holding one rule under each of two topics — so what the view reports
 * about the pack can only have come from the library's own files.
 */
const setupDeclaredPack = async () => {
	const cwd = await seedConfiguredCwd({ config: { 'standards-libraries': { house: './standards/house' }, 'standards-pack': 'house/house' } });
	const files: Record<string, string> = {
		'lightsout-standards.json': '{ "name": "house", "formatVersion": 2 }\n',
		'packs/house.json': JSON.stringify({ description: 'the house rules', include: { topics: ['house/code/demo', 'house/code/react-demo'] } }),
		'rules/code/demo/topic.md': '# Demo\n\nThe document the rule argues under.\n',
		'rules/code/demo/01-house-rule/rule.md': '---\nsummary: what house-rule catches\n---\n\nThe rule prose.\n',
		'rules/code/react-demo/topic.md': '# React demo\n\nProse about react code.\n',
		'rules/code/react-demo/01-react-rule/rule.md': '---\nsummary: what react-rule catches\n---\n\nThe react rule prose.\n',
	};

	for (const [path, content] of Object.entries(files)) {
		const absolutePath = join(cwd, 'standards', 'house', path);

		mkdirSync(dirname(absolutePath), { recursive: true });
		writeFileSync(absolutePath, content);
	}

	return { cwd };
};

/**
 * A repo whose root manifest declares no framework dependency, with a config
 * carrying `standards` on top of the gates — so detection, when it runs, can
 * only pick the node pack.
 */
const setupFrameworkFreeRepo = async ({ standards = {} }: { standards?: Record<string, unknown> } = {}) => {
	const cwd = await seedConfiguredCwd({ config: standards });

	await writeFile(join(cwd, 'package.json'), JSON.stringify({ name: 'plain', dependencies: { zod: '^4.0.0' } }), 'utf8');

	return { cwd };
};

describe('getConfigView', () => {
	test('marks a key this repo actually wrote as coming from its config', async () => {
		const view = await getConfigView({ cwd: repoRoot });

		expect(findField({ sections: view.sections, key: 'gates' })?.fromConfig).toBe(true);
	});

	test('marks a key the file omits as lightsout filling it in', async () => {
		const view = await getConfigView({ cwd: repoRoot });

		expect(findField({ sections: view.sections, key: 'packages-dir' })?.fromConfig).toBe(false);
	});

	test("hands an omitted key the engine's own default rather than a second copy of the number", async () => {
		const view = await getConfigView({ cwd: repoRoot });

		expect(findField({ sections: view.sections, key: 'packages-dir' })?.value).toBe('packages');
		expect(findField({ sections: view.sections, key: 'executor-file-limit' })?.value).toBe(50);
	});

	test('flattens the timeouts block to its two leaves, so a file setting one does not claim the other', async () => {
		const view = await getConfigView({ cwd: repoRoot });

		expect(findField({ sections: view.sections, key: 'timeouts.agent-minutes' })?.value).toBe(60);
		expect(findField({ sections: view.sections, key: 'timeouts.supervisor-minutes' })?.value).toBe(15);
	});

	test('leaves a key with no named default null, which is the row that reads "default: none"', async () => {
		const view = await getConfigView({ cwd: repoRoot });

		expect(findField({ sections: view.sections, key: 'package-gates' })?.fromConfig).toBe(true);
		expect(findField({ sections: view.sections, key: 'standards-pack' })?.value).toBeNull();
	});

	test("carries the schema's own sentence for every row, so the page and the contract cannot disagree", async () => {
		const view = await getConfigView({ cwd: repoRoot });

		expect(view.sections.flatMap((section) => section.fields).every((field) => field.description.length > 0)).toBe(true);
	});

	test.each([
		{ harness: 'claude-code', model: 'claude-opus-5' },
		{ harness: 'codex', model: 'gpt-5.6-terra' },
	])('states the configured $harness harness and $model model at the top level', async ({ harness, model }) => {
		const cwd = await seedConfiguredCwd({ config: { harness, model } });
		const view = await getConfigView({ cwd });

		expect(view.harness).toBe(harness);
		expect(view.model).toBe(model);
	});

	test('records the pack behind every rule, which is what the ledger links with', async () => {
		const view = await getConfigView({ cwd: repoRoot });

		// the library that defines each rule — this repo registers none, so every rule is the built-in library's
		expect([...new Set(view.ruleStates.map((state) => state.library))]).toStrictEqual(['lightsout']);
	});

	test('reports a rule this repo turned up as set by config, at the severity the file asked for', async () => {
		const view = await getConfigView({ cwd: repoRoot });

		const fileSize = view.ruleStates.find((state) => state.rule === 'lightsout/file-size');

		expect(fileSize).toMatchObject({ fromConfig: true, severity: StandardsSeverity.Blocking });
	});

	test('each rule state carries its full name and its id inside the library', async () => {
		const view = await getConfigView({ cwd: repoRoot });

		const fileSize = view.ruleStates.find((state) => state.id === 'file-size');

		expect(fileSize).toEqual(expect.objectContaining({ rule: 'lightsout/file-size', id: 'file-size' }));
	});

	test('each rule state carries the options it runs with in this repo', async () => {
		const cwd = await seedConfiguredCwd({ config: { 'standards-rule-settings': { 'folder-size': { options: { cap: 15 } } } } });

		const view = await getConfigView({ cwd });

		const folderSize = view.ruleStates.find((state) => state.rule === 'lightsout/folder-size');

		expect(folderSize).toEqual(expect.objectContaining({ options: { cap: 15 }, fromConfig: true }));
	});

	test('says a repo with no config has none, rather than answering with the defaults it would have used', async () => {
		await expect(getConfigView({ cwd: withoutConfig })).rejects.toThrow(ConfigNotFoundError);
	});

	test('groups the file into the areas the page reads, in the order it reads them', async () => {
		const view = await getConfigView({ cwd: repoRoot });

		expect(view.sections.map((section) => section.title)).toStrictEqual([
			'Harness',
			'Gates',
			'Standards',
			'Agent commands',
			'Generated',
			'Timeouts',
			'Ship',
			'Ticket tracker',
			'Worktree',
			'Queue',
			'Auto plan',
			'Plan',
			'Implement',
			'Pricing',
			'Docs',
		]);
	});

	test('carries the worktree block on its own row, so the page shows the shared preparation command the file named', async () => {
		const cwd = await seedConfiguredCwd({ config: { worktree: { setup: 'pnpm install' } } });

		const view = await getConfigView({ cwd });

		// the row reads the top-level block, not a key nested under queue or
		// implement — both entry points prepare a fresh tree with the same command
		expect(findField({ sections: view.sections, key: 'worktree' })).toEqual(expect.objectContaining({ value: { setup: 'pnpm install' }, fromConfig: true }));
	});

	test('leaves the worktree row null when the file declares no block, which is the row that reads "default: none"', async () => {
		const cwd = await seedConfiguredCwd();

		const view = await getConfigView({ cwd });

		// the block is opt-in and the engine names no fallback command for it, so
		// there is nothing to fill the row in with
		expect(findField({ sections: view.sections, key: 'worktree' })).toEqual(expect.objectContaining({ value: null, fromConfig: false }));
	});

	test('leaves the harness and the model null when the file names neither, rather than inventing a fallback for them', async () => {
		const cwd = await seedConfiguredCwd();

		const view = await getConfigView({ cwd });

		// the strip drops the chip it has no answer for; what the engine would fall
		// back to at run time is the Harness section's story, not this view's
		expect(view).toEqual(expect.objectContaining({ harness: null, model: null }));
	});

	test('reads the harness and the model off a file that does name them, where the repo strip looks', async () => {
		const cwd = await seedConfiguredCwd({ config: { harness: 'codex', model: 'gpt-5.2' } });

		const view = await getConfigView({ cwd });

		expect(view).toEqual(expect.objectContaining({ harness: 'codex', model: 'gpt-5.2' }));
	});

	test('reads a standards-libraries map back into the Standards section verbatim, without loading a library it names', async () => {
		// neither entry exists on disk: with standards switched off nothing loads a
		// library, so the view can only be showing the map as the file wrote it
		const libraries = { house: './standards/house', acme: '@acme/standards' };
		const cwd = await seedConfiguredCwd({ config: { 'standards-libraries': libraries, 'standards-pack': false } });

		const view = await getConfigView({ cwd });

		const standards = view.sections.find((section) => section.title === 'Standards');
		expect(standards?.fields.map((field) => field.key)).toStrictEqual([
			'standards-pack',
			'package-standards-packs',
			'standards-libraries',
			'standards-rule-settings',
		]);
		expect(findField({ sections: view.sections, key: 'standards-libraries' })).toEqual(expect.objectContaining({ value: libraries, fromConfig: true }));
	});

	test('reports a declared pack as the repo choosing it, with the rules its own topics hold', async () => {
		const { cwd } = await setupDeclaredPack();

		const view = await getConfigView({ cwd });

		// the config named no rule at all — both can only have come from the pack's two topics
		expect({ standardsGroups: view.standardsGroups, rules: view.ruleStates.map((state) => state.rule) }).toStrictEqual({
			standardsGroups: [{ packages: [''], appliesTo: 'repo root (outside packages)', pack: 'house/house', source: 'named' }],
			rules: ['house/house-rule', 'house/react-rule'],
		});
	});

	test('reads a named standards-pack back into the Standards section as the address the file wrote', async () => {
		const { cwd } = await setupDeclaredPack();

		const view = await getConfigView({ cwd });

		expect(findField({ sections: view.sections, key: 'standards-pack' })).toEqual(expect.objectContaining({ value: 'house/house', fromConfig: true }));
	});

	test('names the declaring pack on a rule that came from a declared pack, which is what the ledger links with', async () => {
		const { cwd } = await setupDeclaredPack();

		const view = await getConfigView({ cwd });

		expect(view.ruleStates).toEqual([
			expect.objectContaining({ rule: 'house/house-rule', id: 'house-rule', library: 'house' }),
			expect.objectContaining({ rule: 'house/react-rule', id: 'react-rule', library: 'house' }),
		]);
	});

	test('a config that is not JSON at all comes back as that, rather than as a repo that has no config', async () => {
		const { cwd } = await setupRawConfig({ raw: '{ "gates": ' });

		// the page 404s on absence only; this one has a message the reader can act
		// on, so it travels to the error boundary as itself
		await expect(getConfigView({ cwd })).rejects.toThrow(/is not valid JSON/);
	});

	test('a config the schema refuses names the key it refused, which is what the error boundary shows', async () => {
		const { cwd } = await setupRawConfig({ raw: JSON.stringify({ gates: { check: 'pnpm check' } }) });

		await expect(getConfigView({ cwd })).rejects.toThrow(/gates\.test/);
	});

	test("getConfigView: the view names the detected pack group and each rule's library", async () => {
		const { cwd } = await setupFrameworkFreeRepo();

		const view = await getConfigView({ cwd });

		expect({
			standardsGroups: view.standardsGroups,
			carriesPacks: Object.hasOwn(view, 'packs'),
			carriesChannels: Object.hasOwn(view, 'channels'),
			hasRuleStates: view.ruleStates.length > 0,
			libraries: [...new Set(view.ruleStates.map((state) => state.library))],
		}).toStrictEqual({
			standardsGroups: [{ packages: [''], appliesTo: 'repo root (outside packages)', pack: 'lightsout/node', source: 'detected' }],
			carriesPacks: false,
			carriesChannels: false,
			hasRuleStates: true,
			libraries: ['lightsout'],
		});
	});

	test('getConfigView: standards-pack false shows no group and no rule', async () => {
		const { cwd } = await setupFrameworkFreeRepo({ standards: { 'standards-pack': false } });

		const view = await getConfigView({ cwd });

		expect({ standardsGroups: view.standardsGroups, ruleStates: view.ruleStates }).toStrictEqual({ standardsGroups: [], ruleStates: [] });
	});

	test('lists rule states and packs with no channel', async () => {
		const { cwd } = await setupFrameworkFreeRepo();

		const view = await getConfigView({ cwd });

		// the contract has no packs list today; were one to come back, its entries
		// must carry no channel either, so the check reads it when present
		const { packs = [] } = view as ConfigView & { packs?: Array<Record<string, unknown>> };
		const carriesChannel = (entry: object) => Object.hasOwn(entry, 'channel') || Object.hasOwn(entry, 'channels');
		expect({
			hasRuleStates: view.ruleStates.length > 0,
			ruleStatesWithChannel: view.ruleStates.filter(carriesChannel).map((state) => state.rule),
			packsWithChannel: [...packs, ...view.standardsGroups].filter(carriesChannel),
		}).toStrictEqual({ hasRuleStates: true, ruleStatesWithChannel: [], packsWithChannel: [] });
	});
});
