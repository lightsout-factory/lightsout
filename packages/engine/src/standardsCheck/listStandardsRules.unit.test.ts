import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { resolveStandardsGroups } from '#src/standards/resolveStandardsGroups/resolveStandardsGroups.ts';
import { listStandardsRules } from '#src/standardsCheck/listStandardsRules.ts';
import { getRejectionError } from '#tests/helpers/getRejectionError.ts';

/** Standards are opt-in, so the config a case starts from names the shipped standards pack; a case on another pack, or none, overrides it. */
const baseConfig = { gates: { check: 'true', test: 'true', 'test-coverage': false as const }, 'standards-pack': 'lightsout/standards' };

/**
 * The repo the listing is read for — the shipped library answers regardless,
 * since it travels with the engine, and the pack it gets is the one the config
 * names, lightsout/standards.
 *
 * The workspace root rather than the working directory: this suite runs from
 * inside the engine package, and one case below looks up a document inside the
 * standards pack, which is a sibling rather than a child.
 */
const cwd = join(__dirname, '..', '..', '..', '..');

/**
 * The ids of the rules with a deterministic check. A repo's baseline keys, its config
 * overrides and its frozen refactor work-lists are all written in these
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
 *
 * On 2026-10-02 the library was pruned from 93 rules to 69 and regrouped by
 * goal. Twenty-one ids were retired with no replacement:
 * `ungrouped-domain-utils`, `single-file-domain-folder`,
 * `top-level-domain-nouns`, `casing`, `verbose-names`, `import-type-only`,
 * `module-exports`, `brittle-doc-tags`, `params-interface-docs`,
 * `types-and-interfaces`, `test-multiple-setups`,
 * `test-never-passing-assertion`, `test-only-export`,
 * `oversized-setup-factory`, `test-nested-describe`, `module-out-of-common`,
 * `folder-casing`, `doc-elements`, `named-constant-casing`,
 * `derived-lookup-map` and `props-union-exemption`. Five more were merged into
 * two new ids, and are gone under their old spellings: `test-shared-let`,
 * `test-assert-in-hook` and `test-mock-return-in-hook` became
 * `no-test-state-in-hooks`; `test-in-tests-folder` and
 * `test-not-beside-subject` became `test-beside-subject`. From that date the
 * list holds every deterministic rule, not only the ones that predate the pack format.
 *
 * Later the same day, once a check could read several inputs and a rule could
 * have both kinds of check, ten rules merged into five, each with one check, and
 * are gone under their old spellings: `import-through-index` and
 * `folder-index-file` became `index-files`; `barrel-star` and
 * `code-in-index-file` became `index-file-contents`; `bare-string-union` and
 * `discriminant-const-object` became `named-string-values`;
 * `banned-class-shapes` and the unchecked `class-bright-line` became
 * `prefer-functions`; `type-alias-indirection` and the unchecked
 * `thin-wrapper-functions` became `no-thin-wrappers`.
 *
 * On 2026-10-03 the library was cut down to the fractal and code-style packs.
 * `no-thin-wrappers` and `test-strict-equal-matcher` were retired with the
 * rules they named, not renamed, and `test-mock-wrapper-untyped` merged into
 * `test-mock-untyped`. `single-return` gained a check. The hook
 * and component caps left `function-size` for `react-function-size`, which the
 * framework packs hold and `lightsout/standards` does not, so it is not listed here.
 *
 * On 2026-10-04 the fractal rules were judged one by one against the layout
 * model. `synonym-export-name` and `internal-import-from-outside` were retired
 * with the rules they named, and `module-file-to-folder` gained a check.
 * `file-directly-in-common` became `common-folder-layout` and
 * `shared-code-placement` became `file-placement`, each now asking for more
 * than its old name said.
 */
const durableRuleIds = [
	'prefer-functions',
	'type-assertion',
	'no-any',
	'class-inheritance',
	'explicit-return-type',
	'single-return',
	'single-use-scalar',
	'named-string-values',
	'dead-export',
	'duplicate-function-body',
	'duplicate-code-block',
	'duplicate-export-name',
	'import-path-alias',
	'index-files',
	'index-file-contents',
	'circular-dependencies',
	'multi-export',
	'filename-mismatch',
	'module-file-to-folder',
	'file-placement',
	'common-folder-layout',
	'banned-folder-name',
	'case-collision',
	'function-size',
	'file-size',
	'folder-size',
	'no-test-state-in-hooks',
	'test-mock-prefix',
	'test-mock-untyped',
	'test-manual-mock-cleanup',
	'test-beside-subject',
	'test-support-in-src',
	'test-file-size',
];

/** The shipped library's rules are listed by full name, the name a finding and a baseline key carry. */
const builtInNameOf = ({ id }: { id: string }) => `lightsout/${id}`;

const durableRuleNames = durableRuleIds.map((id) => builtInNameOf({ id }));

/** 'lightsout: code/…' split back into the pack name and the document folder the row names. */
const docPartsOf = ({ doc }: { doc: string }) => {
	const [name, path] = doc.split(': ');

	return { name: name ?? '', path: path ?? '' };
};

/** A temp consumer repo holding no library of its own — the listing reads exactly the pack its config names. */
const setupRepo = () => ({ cwd: mkdtempSync(join(tmpdir(), 'lightsout-list-rules-')) });

/** The listing a repo gets: the groups its config resolves to, listed. The config names lightsout/standards and nothing else unless the case passes its own. */
const listFor = async ({ cwd, config = LightsoutConfig.parse(baseConfig) }: { cwd: string; config?: LightsoutConfig }) =>
	listStandardsRules({ groups: await resolveStandardsGroups({ cwd, config }) });

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

	test('agent-only rules are listed beside the deterministic ones, each marked for which it is', async () => {
		const rules = await listFor({ cwd });

		// the ledger has to admit which of its rules no code run will ever catch,
		// or it reads as though every listed rule were enforced
		expect(rules.some((rule) => rule.deterministic)).toBe(true);
		expect(rules.some((rule) => !rule.deterministic)).toBe(true);
		// and every one of the durable ids is a rule with a deterministic check — a finding, and so
		// a baseline key, can only ever carry one of those
		expect(rules.filter((rule) => durableRuleNames.includes(rule.rule) && !rule.deterministic).map((rule) => rule.rule)).toStrictEqual([]);
	});

	test('every rule names the pack that states it and a document folder inside that pack', async () => {
		const rules = await listFor({ cwd });

		// the doc column is what makes the output actionable — a row naming a
		// document that is not there sends the reader nowhere
		const rulesPath = join(cwd, 'packages', 'lightsout-standards', 'rules');
		const missing = rules.filter((rule) => {
			const { name, path } = docPartsOf({ doc: rule.doc });

			return name !== 'lightsout' || !existsSync(join(rulesPath, path, 'topic.md'));
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
		// from — which is why the test-location rules and `test-file-size` sit
		// here, away from the code rules that check placement and size
		expect(checkedFromTests.sort()).toStrictEqual([
			'lightsout/no-test-state-in-hooks',
			'lightsout/test-beside-subject',
			'lightsout/test-file-size',
			'lightsout/test-manual-mock-cleanup',
			'lightsout/test-mock-prefix',
			'lightsout/test-mock-untyped',
			'lightsout/test-support-in-src',
		]);
	});

	test('the default pack blocks exactly the rules that are wrong on their own terms', async () => {
		// a repo whose config names the pack and sets no rule, so the listing is the
		// pack's defaults rather than this repository's promotions
		const rules = await listFor({ cwd: setupRepo().cwd });
		const blocking = rules
			.filter((rule) => rule.severity === StandardsSeverity.Blocking)
			.map((rule) => rule.rule)
			.sort();

		// types that lie, code nothing uses or that copies other code under a new
		// name, a tree that breaks across filesystems, and tests that are silently
		// weaker than they read. Everything about layout ships advisory.
		expect(blocking).toStrictEqual([
			'lightsout/case-collision',
			'lightsout/dead-export',
			'lightsout/duplicate-function-body',
			'lightsout/explicit-return-type',
			'lightsout/no-any',
			'lightsout/no-test-state-in-hooks',
			'lightsout/test-mock-prefix',
			'lightsout/test-mock-untyped',
			'lightsout/type-assertion',
		]);
	});

	test('a repo that names the pack and sets no rule sees the defaults, unmarked', async () => {
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
});
