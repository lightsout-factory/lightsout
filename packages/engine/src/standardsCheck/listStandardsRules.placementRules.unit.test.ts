import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { listStandardsRules } from '#src/standardsCheck/listStandardsRules.ts';

/**
 * The repo the listing is read for — the shipped pack answers regardless,
 * since it travels with the engine. The workspace root rather than the working
 * directory, as the main suite reads it.
 */
const cwd = join(__dirname, '..', '..', '..', '..');

/** The eight file-placement rules code checks — listed rather than derived, because an id no longer says which kind it is. */
const durablePathRules = [
	'banned-folder-name',
	'file-directly-in-common',
	'folder-index-file',
	'test-in-tests-folder',
	'test-not-beside-subject',
	'test-support-in-src',
	'folder-casing',
	'single-file-domain-folder',
];

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
		const rules = await listStandardsRules({ cwd });
		const docs = Object.fromEntries(
			rules.filter((rule) => durablePathRuleNames.includes(rule.rule)).map((rule) => [rule.rule, docPartsOf({ doc: rule.doc }).path]),
		);

		// the main suite proves a document is there, not that it is the right one:
		// the folder-index-file rule comes from module-api, the four
		// test-location rules from unit-testing, and the rest from folder-structure
		expect(docs).toStrictEqual({
			'lightsout/banned-folder-name': 'code/architecture/folder-structure',
			'lightsout/file-directly-in-common': 'code/architecture/folder-structure',
			'lightsout/folder-index-file': 'code/style-guide/structure/module-api',
			'lightsout/test-in-tests-folder': 'tests/unit-testing',
			'lightsout/test-not-beside-subject': 'tests/unit-testing',
			'lightsout/test-support-in-src': 'tests/unit-testing',
			'lightsout/folder-casing': 'code/architecture/folder-structure',
			'lightsout/single-file-domain-folder': 'code/architecture/folder-structure',
		});
	});

	test('the file-placement rules ship advisory — the default pack blocks only what is wrong on its own terms', async () => {
		const rules = await listStandardsRules({ cwd });
		const severities = Object.fromEntries(rules.filter((rule) => durablePathRuleNames.includes(rule.rule)).map((rule) => [rule.rule, rule.severity]));

		// every file-placement rule is a layout opinion — where a file goes, what a folder
		// is called, where a test sits. The pack reports them and hands them to
		// the refactor agent, but does not block a repository on day one for a
		// layout it has not agreed to; a strict repo promotes them in its own
		// standards-rule-settings, as this repository does
		expect(severities).toStrictEqual({
			'lightsout/banned-folder-name': StandardsSeverity.Advisory,
			'lightsout/file-directly-in-common': StandardsSeverity.Advisory,
			'lightsout/folder-index-file': StandardsSeverity.Advisory,
			'lightsout/test-in-tests-folder': StandardsSeverity.Advisory,
			'lightsout/test-not-beside-subject': StandardsSeverity.Advisory,
			'lightsout/test-support-in-src': StandardsSeverity.Advisory,
			'lightsout/folder-casing': StandardsSeverity.Advisory,
			'lightsout/single-file-domain-folder': StandardsSeverity.Advisory,
		});
	});

	test('no file-placement rule carries a number a repo could tune', async () => {
		const rules = await listStandardsRules({ cwd });
		const tunable = rules.filter((rule) => durablePathRuleNames.includes(rule.rule) && Object.keys(rule.options).length > 0);

		// every threshold in this group is a closed list of names from a doc, never a
		// count — a knob here would be a rule that can be quietly widened until it
		// stops firing
		expect(tunable.map((rule) => rule.rule)).toStrictEqual([]);
	});
});
