import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import { StandardsPackSource } from '#src/contracts/standards/StandardsPackSource.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import type { StandardsGroup } from '#src/standards/common/types/StandardsGroup.ts';
import { resolveStandardsGroups } from '#src/standards/resolveStandardsGroups.ts';
import type { ResolvedRuleState } from '#src/standardsCheck/common/types/ResolvedRuleState.ts';
import { listStandardsRules } from '#src/standardsCheck/listStandardsRules.ts';
import type { LoadedStandardsRule } from '#src/standardsLibraries/common/types/LoadedStandardsRule.ts';
import type { ResolvedPackRule } from '#src/standardsLibraries/common/types/ResolvedPackRule.ts';
import { getRejectionError } from '#tests/helpers/getRejectionError.ts';

const baseConfig = { gates: { check: 'true', test: 'true', 'test-coverage': false as const } };

/**
 * The repo the listing is read for — the shipped library answers regardless,
 * since it travels with the engine, and the repo's root manifest names no
 * framework, so the pack it gets is lightsout/node.
 *
 * The workspace root rather than the working directory: this suite runs from
 * inside the engine package, and one case below looks up a document inside the
 * standards pack, which is a sibling rather than a child.
 */
const cwd = join(__dirname, '..', '..', '..', '..');

/**
 * The rule ids that predate the pack format. A repo's baseline keys, its
 * config overrides and its frozen refactor work-lists are all written in these
 * strings, so one of them going missing is a silent break in persisted data —
 * which is why they are restated here rather than read back off the pack.
 *
 * Removing an id from this list is a deliberate retirement: the rule's folder,
 * every config override naming it, and this row are deleted in one change
 * (path-test-untested-subject-not-public went that way, 2026-08-24). A rename
 * is not a retirement: on 2026-08-25 eighteen ids were renamed to say what the
 * rule finds rather than how it finds it — sixteen of them here, `clone` among
 * them — and the finding history keyed to the old spellings was reset. On
 * 2026-09-24 the rules that read a folder's `index.ts` as its public API were
 * retired with the model itself: `barrel-dead-entry`, `barrel-is-only-consumer`,
 * `barrel-under-common`, `module-boundary`, and the check behind `placement`.
 */
const durableRuleIds = [
	'banned-folder-name',
	'barrel-star',
	'folder-size',
	'dead-export',
	'duplicate-code-block',
	'duplicate-export-name',
	'duplicate-function-body',
	'file-directly-in-common',
	'filename-mismatch',
	'folder-casing',
	'multi-export',
	'oversized-setup-factory',
	'single-file-domain-folder',
	'file-size',
	'function-size',
	'synonym-export-name',
	'test-assert-in-hook',
	'test-in-tests-folder',
	'test-manual-mock-cleanup',
	'test-mock-prefix',
	'test-mock-return-in-hook',
	'test-mock-untyped',
	'test-mock-wrapper-untyped',
	'test-multiple-setups',
	'test-nested-describe',
	'test-not-beside-subject',
	'test-only-export',
	'test-shared-let',
	'test-strict-equal-matcher',
	'test-support-in-src',
	'ungrouped-domain-utils',
];

/** The shipped library's rules are listed by full name, the name a finding and a baseline key carry. */
const builtInNameOf = ({ id }: { id: string }) => `lightsout/${id}`;

const durableRuleNames = durableRuleIds.map((id) => builtInNameOf({ id }));

/** 'lightsout: code/…' split back into the pack name and the document folder the row names. */
const docPartsOf = ({ doc }: { doc: string }) => {
	const [name, path] = doc.split(': ');

	return { name: name ?? '', path: path ?? '' };
};

interface LibrarySpec {
	/** Repo-relative folder the library is written under. */
	at: string;
	name: string;
	ruleId: string;
	severity?: typeof StandardsSeverity.Blocking | typeof StandardsSeverity.Advisory;
	options?: Record<string, number>;
	/** The topics its one pack, `<name>/<name>`, brings in; its own document alone when omitted. */
	topics?: string[];
}

/**
 * A judgment-only standards library written under `at`, holding one rule that
 * declares whatever the caller passes and one pack named after the library.
 * Nothing here is shipped by the engine, so a row read back off it proves the
 * listing carries the library author's own words rather than the defaults.
 */
const writeLibrary = ({
	cwd,
	at,
	name,
	ruleId,
	severity = StandardsSeverity.Advisory,
	options = {},
	topics = [`${name}/code/demo`],
}: LibrarySpec & { cwd: string }) => {
	const libraryPath = join(cwd, at);
	const rulePath = `code/demo/01-${ruleId}`;
	const optionLines = Object.entries(options).map(([key, value]) => `  ${key}: ${value}`);
	const optionsBlock = optionLines.length === 0 ? '' : `options:\n${optionLines.join('\n')}\n`;
	const files: Record<string, string> = {
		'lightsout-standards.json': `{ "name": "${name}", "formatVersion": 1 }\n`,
		[`packs/${name}.json`]: JSON.stringify({ description: `the ${name} pack`, include: { topics } }),
		'code/demo/topic.md': '# Demo\n\nThe document the rule argues under.\n',
		[`${rulePath}/rule.md`]: `---\nsummary: what ${ruleId} catches\nseverity: ${severity}\n${optionsBlock}---\n\nThe rule prose.\n`,
		[`${rulePath}/fixtures/pass/src/example.ts`]: 'export const example = 1;\n',
		[`${rulePath}/fixtures/fail/src/example.ts`]: 'export const example = 2;\n',
	};

	for (const [path, content] of Object.entries(files)) {
		const absolutePath = join(libraryPath, path);

		mkdirSync(dirname(absolutePath), { recursive: true });
		writeFileSync(absolutePath, content);
	}
};

/** A temp consumer repo holding the given libraries — the listing reads exactly the pack its config names. */
const setupRepo = ({ libraries = [] }: { libraries?: LibrarySpec[] } = {}) => {
	const repoCwd = mkdtempSync(join(tmpdir(), 'lightsout-list-rules-'));

	for (const spec of libraries) {
		writeLibrary({ cwd: repoCwd, ...spec });
	}

	return { cwd: repoCwd };
};

/** The listing a repo gets: the groups its config resolves to, listed. */
const listFor = async ({ cwd, config }: { cwd: string; config?: LightsoutConfig }) =>
	listStandardsRules({ groups: await resolveStandardsGroups({ cwd, config }) });

/** A loaded rule held in memory — the group listing reads rules the pack already resolved, never a folder. */
const loadedRule = (overrides: Partial<LoadedStandardsRule> & { id: string; library: string }): LoadedStandardsRule => ({
	name: `${overrides.library}/${overrides.id}`,
	set: 'code',
	documentPath: 'code/demo',
	summary: `what ${overrides.id} catches`,
	prose: 'The rule prose.',
	checked: false,
	defaultSeverity: StandardsSeverity.Advisory,
	defaultOptions: {},
	requires: [],
	fixturesPath: `/packages/${overrides.library}/${overrides.id}/fixtures`,
	...overrides,
});

/**
 * One group whose pack holds two rules from two libraries, listed out of name
 * order. The checked rule's rule.md default, its pack grade and its final state
 * all differ, so a row can only match by reading the state.
 */
const setupGroup = () => {
	const aardvark = loadedRule({ id: 'aardvark-rule', library: 'team', set: 'tests', documentPath: 'tests/demo' });
	const zebra = loadedRule({
		id: 'zebra-rule',
		library: 'acme',
		checked: true,
		defaultSeverity: StandardsSeverity.Off,
		defaultOptions: { maxLines: 10 },
	});
	const packRules: ResolvedPackRule[] = [
		{ rule: aardvark, severity: StandardsSeverity.Advisory, options: {} },
		{ rule: zebra, severity: StandardsSeverity.Advisory, options: { maxLines: 40 } },
	];
	const states = new Map<string, ResolvedRuleState>([
		['team/aardvark-rule', { severity: StandardsSeverity.Advisory, options: {}, fromConfig: false, reachesAgents: true }],
		['acme/zebra-rule', { severity: StandardsSeverity.Blocking, options: { maxLines: 60 }, fromConfig: true, reachesAgents: true }],
	]);
	const groups: StandardsGroup[] = [{ packages: [''], pack: { name: 'acme/house', topics: [], rules: packRules }, source: StandardsPackSource.Named, states }];

	return { groups };
};

/**
 * Two groups that split the workspace: the repo root and engine on one pack,
 * web-app on another. Both packs hold both rules; alpha-rule resolves to the
 * same state in each, and beta-rule is blocking in the wider group but
 * advisory in web-app's.
 */
const setupSplitGroups = () => {
	const alpha = loadedRule({ id: 'alpha-rule', library: 'acme' });
	const beta = loadedRule({ id: 'beta-rule', library: 'acme', checked: true });
	const packRules: ResolvedPackRule[] = [
		{ rule: alpha, severity: StandardsSeverity.Advisory, options: {} },
		{ rule: beta, severity: StandardsSeverity.Advisory, options: { maxLines: 40 } },
	];
	const alphaState: ResolvedRuleState = { severity: StandardsSeverity.Advisory, options: {}, fromConfig: false, reachesAgents: true };
	const rootStates = new Map<string, ResolvedRuleState>([
		['acme/alpha-rule', alphaState],
		['acme/beta-rule', { severity: StandardsSeverity.Blocking, options: { maxLines: 40 }, fromConfig: false, reachesAgents: true }],
	]);
	const webAppStates = new Map<string, ResolvedRuleState>([
		['acme/alpha-rule', alphaState],
		['acme/beta-rule', { severity: StandardsSeverity.Advisory, options: { maxLines: 40 }, fromConfig: false, reachesAgents: true }],
	]);
	const groups: StandardsGroup[] = [
		{ packages: ['', 'engine'], pack: { name: 'acme/node', topics: [], rules: packRules }, source: StandardsPackSource.Detected, states: rootStates },
		{ packages: ['web-app'], pack: { name: 'acme/react-app', topics: [], rules: packRules }, source: StandardsPackSource.Named, states: webAppStates },
	];

	return { groups };
};

describe('listStandardsRules', () => {
	test('lists every rule the loaded packs declare, sorted by id', async () => {
		const rules = await listFor({ cwd });

		// --list is the enforcement ledger: a rule missing from it is a rule
		// nobody can find out about
		expect(rules.length > durableRuleIds.length).toBe(true);
		expect(rules.map((rule) => rule.rule)).toStrictEqual([...rules.map((rule) => rule.rule)].sort());
		expect(new Set(rules.map((rule) => rule.rule)).size).toBe(rules.length);
	});

	test('every rule id a repo may already have written down is still declared', async () => {
		const rules = await listFor({ cwd });
		const ids = new Set(rules.map((rule) => rule.rule));

		// a baseline entry, a config override or a parked work-list names these
		// strings — renaming one silently unbaselines whatever it suppressed
		expect(durableRuleIds.filter((id) => !ids.has(builtInNameOf({ id })))).toStrictEqual([]);
	});

	test('judgment-only rules are listed beside the machine-checked ones, each marked for which it is', async () => {
		const rules = await listFor({ cwd });

		// the ledger has to admit which of its rules no code run will ever catch,
		// or it reads as though every listed rule were enforced
		expect(rules.some((rule) => rule.checked)).toBe(true);
		expect(rules.some((rule) => !rule.checked)).toBe(true);
		// and every one of the durable ids is a rule code checks — they are the
		// rules that had a check before the pack format existed
		expect(rules.filter((rule) => durableRuleNames.includes(rule.rule) && !rule.checked).map((rule) => rule.rule)).toStrictEqual([]);
	});

	test('every rule names the pack that states it and a document folder inside that pack', async () => {
		const rules = await listFor({ cwd });

		// the doc column is what makes the output actionable — a row naming a
		// document that is not there sends the reader nowhere
		const libraryPath = join(cwd, 'packages', 'standards-typescript');
		// the loader's rule: the topic trees sit under rules/ when the library holds one
		const setsPath = existsSync(join(libraryPath, 'rules')) ? join(libraryPath, 'rules') : libraryPath;
		const missing = rules.filter((rule) => {
			const { name, path } = docPartsOf({ doc: rule.doc });

			return name !== 'lightsout' || !existsSync(join(setsPath, path, 'topic.md'));
		});

		expect(missing.map((rule) => `${rule.rule} → ${rule.doc}`)).toStrictEqual([]);
	});

	test('every rule carries a summary of its own', async () => {
		const rules = await listFor({ cwd });

		expect(rules.every((rule) => rule.summary.length > 0)).toBe(true);
		// no two rules describe themselves identically — that would mean one of
		// them is not really its own rule
		expect(new Set(rules.map((rule) => rule.summary)).size).toBe(rules.length);
	});

	test('the rules drawn from the tests tree are the test-writing rules, and no code rule is among them', async () => {
		const rules = await listFor({ cwd });
		const fromTests = rules.filter((rule) => docPartsOf({ doc: rule.doc }).path.startsWith('tests/'));
		const checkedFromTests = fromTests.filter((rule) => durableRuleNames.includes(rule.rule)).map((rule) => rule.rule);

		// which half of the ledger holds a rule is read off the document it comes
		// from — which is why `test-only-export` and the four test-location rules
		// sit here, away from the passes they used to share
		expect(checkedFromTests.sort()).toStrictEqual([
			'lightsout/oversized-setup-factory',
			'lightsout/test-assert-in-hook',
			'lightsout/test-in-tests-folder',
			'lightsout/test-manual-mock-cleanup',
			'lightsout/test-mock-prefix',
			'lightsout/test-mock-return-in-hook',
			'lightsout/test-mock-untyped',
			'lightsout/test-mock-wrapper-untyped',
			'lightsout/test-multiple-setups',
			'lightsout/test-nested-describe',
			'lightsout/test-not-beside-subject',
			'lightsout/test-only-export',
			'lightsout/test-shared-let',
			'lightsout/test-strict-equal-matcher',
			'lightsout/test-support-in-src',
		]);
	});

	test('the default pack blocks exactly the rules that are wrong on their own terms', async () => {
		// a repo with no config of its own, so the listing is the pack's defaults
		// rather than this repository's promotions
		const rules = await listFor({ cwd: setupRepo().cwd });
		const blocking = rules
			.filter((rule) => rule.severity === StandardsSeverity.Blocking)
			.map((rule) => rule.rule)
			.sort();

		// types that lie, code nothing uses, a tree that breaks across
		// filesystems, doc tags another tool owns, and tests that are silently
		// weaker than they read or can never pass at all. Everything about
		// layout ships advisory.
		expect(blocking).toStrictEqual([
			'lightsout/brittle-doc-tags',
			'lightsout/case-collision',
			'lightsout/dead-export',
			'lightsout/duplicate-function-body',
			'lightsout/explicit-return-type',
			'lightsout/import-type-only',
			'lightsout/no-any',
			'lightsout/test-assert-in-hook',
			'lightsout/test-mock-prefix',
			'lightsout/test-mock-untyped',
			'lightsout/test-mock-wrapper-untyped',
			'lightsout/test-never-passing-assertion',
			'lightsout/test-shared-let',
			'lightsout/test-strict-equal-matcher',
			'lightsout/type-assertion',
		]);
	});

	test('a repo that says nothing sees the defaults, unmarked', async () => {
		const rules = await listFor({ cwd, config: LightsoutConfig.parse(baseConfig) });
		const duplicateBlock = rules.find((rule) => rule.rule === 'lightsout/duplicate-code-block');

		expect(duplicateBlock?.severity).toBe(StandardsSeverity.Advisory);
		expect(duplicateBlock?.fromConfig).toBe(false);
		// the rule's live numbers travel with it
		expect(duplicateBlock?.options).toStrictEqual({ minTokens: 50 });
	});

	test('a rule the config named is marked, so policy reads apart from default', async () => {
		const rules = await listFor({
			cwd,
			config: LightsoutConfig.parse({
				...baseConfig,
				'standards-rule-settings': { 'filename-mismatch': 'off', 'duplicate-code-block': { options: { minTokens: 90 } } },
			}),
		});

		const mismatch = rules.find((rule) => rule.rule === 'lightsout/filename-mismatch');
		const duplicateBlock = rules.find((rule) => rule.rule === 'lightsout/duplicate-code-block');

		expect(mismatch?.severity).toBe(StandardsSeverity.Off);
		expect(mismatch?.fromConfig).toBe(true);
		// an options-only override still counts as policy
		expect(duplicateBlock?.fromConfig).toBe(true);
		expect(duplicateBlock?.options).toStrictEqual({ minTokens: 90 });
		// and every unnamed rule stays unmarked
		expect(rules.filter((rule) => rule.fromConfig).length).toBe(2);
	});

	test('a config key naming no loaded rule refuses the whole listing, and says which ids are real', async () => {
		const error = await getRejectionError({
			promise: listFor({ cwd, config: LightsoutConfig.parse({ ...baseConfig, 'standards-rule-settings': { 'duplicate-code-block-typo': 'off' } }) }),
		});

		// printing a ledger that quietly ignored the typo would confirm a policy
		// the repo does not actually have
		expect(error.message).toContain('standards-rule-settings names "duplicate-code-block-typo"');
		expect(error.message).toContain('duplicate-code-block');
	});

	test('a row restates what the pack author declared, down to the numbers', async () => {
		const { cwd: repo } = setupRepo({
			libraries: [{ at: 'standards/house', name: 'house', ruleId: 'house-rule', severity: StandardsSeverity.Blocking, options: { maxLines: 40 } }],
		});

		const rules = await listFor({
			cwd: repo,
			config: LightsoutConfig.parse({ ...baseConfig, 'standards-libraries': { house: './standards/house' }, 'standards-pack': 'house/house' }),
		});

		// nothing in this pack ships with the engine, so the row can only have
		// come from the rule's own front matter — including that no code checks it
		expect(rules).toStrictEqual([
			{
				rule: 'house/house-rule',
				doc: 'house: code/demo',
				summary: 'what house-rule catches',
				checked: false,
				severity: StandardsSeverity.Blocking,
				fromConfig: false,
				options: { maxLines: 40 },
				packages: [''],
			},
		]);
	});

	test('rules from several packs are one ledger sorted by id, each row naming the pack it came from', async () => {
		const { cwd: repo } = setupRepo({
			libraries: [
				{ at: 'standards/house', name: 'house', ruleId: 'zebra-rule', topics: ['team/code/demo', 'house/code/demo'] },
				{ at: 'standards/team', name: 'team', ruleId: 'aardvark-rule' },
			],
		});

		const rules = await listFor({
			cwd: repo,
			config: LightsoutConfig.parse({
				...baseConfig,
				'standards-libraries': { team: './standards/team', house: './standards/house' },
				'standards-pack': 'house/house',
			}),
		});

		// a reader looking a rule up scans one alphabetical list, not one list per
		// library — and still sees which library to argue with about each rule
		expect(rules.map((rule) => `${rule.rule} → ${rule.doc}`)).toStrictEqual(['house/zebra-rule → house: code/demo', 'team/aardvark-rule → team: code/demo']);
	});

	test('a repo that turned standards packs off lists nothing rather than the defaults', async () => {
		const { cwd: repo } = setupRepo();

		const rules = await listFor({ cwd: repo, config: LightsoutConfig.parse({ ...baseConfig, 'standards-pack': false }) });

		// listing the shipped rules here would advertise a policy this repo opted out of
		expect(rules).toStrictEqual([]);
	});

	test('a declared pack that cannot load refuses the listing instead of printing a shorter one', async () => {
		const { cwd: repo } = setupRepo({ libraries: [{ at: 'standards/house', name: 'house', ruleId: 'house-rule' }] });

		const error = await getRejectionError({
			promise: listFor({
				cwd: repo,
				config: LightsoutConfig.parse({
					...baseConfig,
					'standards-libraries': { house: './standards/house', ghost: './standards/ghost' },
					'standards-pack': 'house/house',
				}),
			}),
		});

		// a ledger missing the half that failed to load reads as a repo that enforces less than it does
		expect(error.message).toContain('standards library ghost (./standards/ghost) will not load');
		expect(error.message).toContain(`${join(repo, 'standards/ghost')} holds no lightsout-standards.json`);
	});

	test('each listing names its rule by full name', async () => {
		const { cwd: repo } = setupRepo({
			libraries: [{ at: 'standards/acme', name: 'acme', ruleId: 'size', severity: StandardsSeverity.Blocking, options: { maxLines: 40 } }],
		});

		const rules = await listFor({
			cwd: repo,
			config: LightsoutConfig.parse({ ...baseConfig, 'standards-libraries': { acme: './standards/acme' }, 'standards-pack': 'acme/acme' }),
		});

		// the rule column is the name a finding carries, so it spells the library
		// as well as the rule — another library may hold its own `size`
		expect(rules).toStrictEqual([
			{
				rule: 'acme/size',
				doc: 'acme: code/demo',
				summary: 'what size catches',
				checked: false,
				severity: StandardsSeverity.Blocking,
				fromConfig: false,
				options: { maxLines: 40 },
				packages: [''],
			},
		]);
	});

	test("each listing carries the rule's resolved options, config override included", async () => {
		const config = LightsoutConfig.parse({ ...baseConfig, 'standards-rule-settings': { 'file-size': { options: { tsxFile: 400 } } } });

		const rules = await listFor({ cwd, config });

		const optionsOf = Object.fromEntries(
			rules
				.filter((rule) => ['lightsout/file-size', 'lightsout/duplicate-code-block', 'lightsout/banned-folder-name'].includes(rule.rule))
				.map((rule) => [rule.rule, rule.options]),
		);

		// the override replaces only the key it names, so the ts cap keeps its
		// rule.md default beside the retuned tsx cap; a rule the config never
		// names shows its own defaults, and a rule with no numbers shows none
		expect(optionsOf).toStrictEqual({
			'lightsout/banned-folder-name': {},
			'lightsout/duplicate-code-block': { minTokens: 50 },
			'lightsout/file-size': { file: 250, tsxFile: 400 },
		});
	});

	test("listStandardsRules: lists the groups' pack rules at their resolved state", () => {
		const { groups } = setupGroup();

		const listed = listStandardsRules({ groups });
		const unlisted = listStandardsRules({ groups: [] });

		// the severity, options and config mark are the group's final state, not
		// the rule.md defaults nor the pack's own grade; the doc names the library
		// that states each rule; and the rows read as one list sorted by full name
		expect({ listed, unlisted }).toStrictEqual({
			listed: [
				{
					rule: 'acme/zebra-rule',
					doc: 'acme: code/demo',
					summary: 'what zebra-rule catches',
					checked: true,
					severity: StandardsSeverity.Blocking,
					fromConfig: true,
					options: { maxLines: 60 },
					packages: [''],
				},
				{
					rule: 'team/aardvark-rule',
					doc: 'team: tests/demo',
					summary: 'what aardvark-rule catches',
					checked: false,
					severity: StandardsSeverity.Advisory,
					fromConfig: false,
					options: {},
					packages: [''],
				},
			],
			unlisted: [],
		});
	});

	test('a rule two groups hold is listed once, by full name', () => {
		const { groups } = setupGroup();

		const listed = listStandardsRules({ groups: [...groups, ...groups] });

		expect(listed.map((listing) => listing.rule)).toStrictEqual(['acme/zebra-rule', 'team/aardvark-rule']);
	});

	test('lists a rule once per distinct state, naming the packages each state applies to', () => {
		const { groups } = setupSplitGroups();

		const listed = listStandardsRules({ groups });

		// a rule at one state everywhere is one row covering every package; a rule
		// graded differently per package is one row per grade, the wider set first
		expect(listed).toStrictEqual([
			{
				rule: 'acme/alpha-rule',
				doc: 'acme: code/demo',
				summary: 'what alpha-rule catches',
				checked: false,
				severity: StandardsSeverity.Advisory,
				fromConfig: false,
				options: {},
				packages: ['', 'engine', 'web-app'],
			},
			{
				rule: 'acme/beta-rule',
				doc: 'acme: code/demo',
				summary: 'what beta-rule catches',
				checked: true,
				severity: StandardsSeverity.Blocking,
				fromConfig: false,
				options: { maxLines: 40 },
				packages: ['', 'engine'],
			},
			{
				rule: 'acme/beta-rule',
				doc: 'acme: code/demo',
				summary: 'what beta-rule catches',
				checked: true,
				severity: StandardsSeverity.Advisory,
				fromConfig: false,
				options: { maxLines: 40 },
				packages: ['web-app'],
			},
		]);
	});
});
