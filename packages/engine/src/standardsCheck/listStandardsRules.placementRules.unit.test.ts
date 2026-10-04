import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { resolveStandardsGroups } from '#src/standards/resolveStandardsGroups.ts';
import { listStandardsRules } from '#src/standardsCheck/listStandardsRules.ts';

/**
 * The repo the listing is read for — the shipped library answers regardless,
 * since it travels with the engine. The workspace root rather than the working
 * directory, as the main suite reads it.
 */
const cwd = join(__dirname, '..', '..', '..', '..');

/** Standards are opt-in, so the config names the shipped standards pack — and sets no rule, so every row is the pack's default. */
const standardsPackConfig: LightsoutConfig = { gates: { check: 'true', test: 'true', 'test-coverage': false }, 'standards-pack': 'lightsout/standards' };

/** The listing a repo on the standards pack gets with no rule settings of its own: the groups it resolves to, listed. */
const listDefaults = async () => listStandardsRules({ groups: await resolveStandardsGroups({ cwd, config: standardsPackConfig }) });

/** The five file-placement rules with a deterministic check — listed rather than derived, because an id no longer says which kind it is. */
const durablePathRules = ['banned-folder-name', 'common-folder-layout', 'index-files', 'test-beside-subject', 'test-support-in-src'];

/** The shipped library's rules are listed by full name, the name a finding and a baseline key carry. */
const builtInNameOf = ({ id }: { id: string }) => `lightsout/${id}`;

const durablePathRuleNames = durablePathRules.map((id) => builtInNameOf({ id }));

/** 'lightsout: code/…' split back into the pack name and the document folder the row names. */
const docPartsOf = ({ doc }: { doc: string }) => {
	const [name, path] = doc.split(': ');

	return { name: name ?? '', path: path ?? '' };
};

describe('listStandardsRules file-placement rules', () => {
	test('each file-placement rule names the document that actually states it', async () => {
		const rules = await listDefaults();
		const docs = Object.fromEntries(
			rules.filter((rule) => durablePathRuleNames.includes(rule.rule)).map((rule) => [rule.rule, docPartsOf({ doc: rule.doc }).path]),
		);

		// the main suite proves a document is there, not that it is the right one:
		// the index-files rule comes from imports, the two test-location
		// rules from the tests tree's fractal topic, and the rest from layout
		expect(docs).toStrictEqual({
			'lightsout/banned-folder-name': 'code/fractal/layout',
			'lightsout/common-folder-layout': 'code/fractal/layout',
			'lightsout/index-files': 'code/fractal/imports',
			'lightsout/test-beside-subject': 'tests/fractal',
			'lightsout/test-support-in-src': 'tests/fractal',
		});
	});

	test('the file-placement rules ship advisory — the default pack blocks only what is wrong on its own terms', async () => {
		const rules = await listDefaults();
		const severities = Object.fromEntries(rules.filter((rule) => durablePathRuleNames.includes(rule.rule)).map((rule) => [rule.rule, rule.severity]));

		// every file-placement rule is a layout opinion — where a file goes, what a folder
		// is called, where a test sits. The pack reports them and hands them to
		// the refactor agent, but does not block a repository on day one for a
		// layout it has not agreed to; a strict repo promotes them in its own
		// standards-rule-settings, as this repository does
		expect(severities).toStrictEqual({
			'lightsout/banned-folder-name': StandardsSeverity.Advisory,
			'lightsout/common-folder-layout': StandardsSeverity.Advisory,
			'lightsout/index-files': StandardsSeverity.Advisory,
			'lightsout/test-beside-subject': StandardsSeverity.Advisory,
			'lightsout/test-support-in-src': StandardsSeverity.Advisory,
		});
	});

	test('the one number a repo can tune among the file-placement rules is the size at which a common/ is grouped', async () => {
		const rules = await listDefaults();
		const tunable = rules.filter((rule) => durablePathRuleNames.includes(rule.rule) && Object.keys(rule.options).length > 0);

		// every other threshold in this group is a closed list of names from a doc,
		// never a count — a knob there would be a rule that can be quietly widened
		// until it stops firing. This one mirrors the folder size cap, which is a
		// count a repo already tunes
		expect(tunable.map((rule) => ({ rule: rule.rule, options: rule.options }))).toStrictEqual([
			{ rule: 'lightsout/common-folder-layout', options: { cap: 20 } },
		]);
	});
});
