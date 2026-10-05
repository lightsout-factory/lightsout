import { describe, expect, test } from '@jest/globals';
import { configKeyDescriptions } from '#src/views/common/constants/configKeyDescriptions.ts';
import { renderConfigKeyReference } from '#src/views/renderConfigKeyReference.ts';

/** The table's body — every line after the header and its delimiter. */
const bodyLines = () => renderConfigKeyReference().split('\n').slice(2);

/** The key a row names, read back out of its first cell's backticks. */
const rowKey = ({ line }: { line: string }) => line.split(' | ')[0].replace('| `', '').replace('`', '');

/** One key's row, or undefined when nothing names it. */
const findRow = ({ key }: { key: string }) => bodyLines().find((line) => rowKey({ line }) === key);

describe('renderConfigKeyReference', () => {
	test('opens with the header and its delimiter, so the region is a table on its own', () => {
		const lines = renderConfigKeyReference().split('\n');

		expect(lines[0]).toBe('| Field | Required | What it controls |');
		expect(lines[1]).toBe('| --- | ---: | --- |');
		expect(lines.filter((line) => line === '| Field | Required | What it controls |')).toHaveLength(1);
	});

	test('right-aligns the Required column, as every other table on the page has it', () => {
		expect(renderConfigKeyReference().split('\n')[1].split(' | ')[1]).toBe('---:');
	});

	test('gives every described key exactly one row, which is what makes a new key appear in the document', () => {
		expect(bodyLines().map((line) => rowKey({ line }))).toStrictEqual(Object.keys(configKeyDescriptions));
	});

	test('names no key the constant does not describe, so the region can hold no row no code produces', () => {
		expect(bodyLines().filter((line) => configKeyDescriptions[rowKey({ line })] === undefined)).toStrictEqual([]);
	});

	test('reads the Required column off the schema — `gates` is the one key a config must write', () => {
		expect(findRow({ key: 'gates' })).toContain('| yes |');
		expect(findRow({ key: 'harness' })).toContain('| no |');
	});

	test('follows a dotted key into its block, which is how the two timeout leaves resolve at all', () => {
		expect(findRow({ key: 'timeouts.agent-minutes' })).toContain('| no |');
	});

	test('carries each key’s own sentence as the third cell, so the document and the page cannot disagree', () => {
		expect(findRow({ key: 'packages-dir' })).toBe(`| \`packages-dir\` | no | ${configKeyDescriptions['packages-dir']} |`);
	});

	test('renderConfigKeyReference: the plan row names the renamed default-work-order-mode key', () => {
		const planRow = findRow({ key: 'plan' });

		expect(planRow).toContain('plan.default-work-order-mode');
		expect(planRow).not.toContain('default-ticket-mode');
	});

	test('the standards-libraries row is optional and says how a folder is told from a package and that lightsout is reserved', () => {
		const librariesRow = findRow({ key: 'standards-libraries' });

		expect(librariesRow).toMatch(/^\| `standards-libraries` \| no \| .*`\.\/`.*npm package.*manifest `name`.*`lightsout` is built in and reserved/);
	});

	test('the standards-rule-settings row says a key is a full rule name, or a short id only one loaded rule has', () => {
		const settingsRow = findRow({ key: 'standards-rule-settings' });

		expect(settingsRow).toMatch(/full rule name \(`<library>\/<rule>`\).*short rule id/);
		expect(settingsRow).not.toContain('keyed by rule id');
	});

	test('the standards-pack row is optional and names the address form, a list, opt-in with false for none, and conditional packs', () => {
		const packRow = findRow({ key: 'standards-pack' });

		expect(packRow).toMatch(
			/^\| `standards-pack` \| no \| .*`<library>\/<pack>`.*a list of them.*opt-in.*unset and `false` both mean no standards.*`applies-when`/,
		);
	});

	test('the standards-rule-settings row says it is the last layer over the selected pack, and what off, blocking and advisory do there', () => {
		const settingsRow = findRow({ key: 'standards-rule-settings' });

		expect(settingsRow).toMatch(/over the selected pack as the last layer/);
		expect(settingsRow).toMatch(/`off` stops a rule running but keeps its prose/);
		expect(settingsRow).toMatch(/`blocking` or `advisory` turns on a rule the pack ships off/);
	});

	test('the deleted standards-packs and standards-channels keys have no row', () => {
		const deletedRows = [findRow({ key: 'standards-packs' }), findRow({ key: 'standards-channels' })];

		expect(deletedRows).toStrictEqual([undefined, undefined]);
	});

	test('the executor-file-limit row is optional, names the touched-file ceiling of 70 and exempts move-folders-and-files beside rename-only', () => {
		const fileLimitRow = findRow({ key: 'executor-file-limit' }) ?? '';

		const named = {
			optional: fileLimitRow.startsWith('| `executor-file-limit` | no | '),
			ceiling: /touched-file ceiling of 70 source files/.test(fileLimitRow),
			renameOnly: /rename-only/.test(fileLimitRow),
			moveFoldersAndFiles: /move-folders-and-files plan or phase is exempt/.test(fileLimitRow),
			fileBudget: /`## File Budget`/.test(fileLimitRow),
		};

		expect(named).toStrictEqual({ optional: true, ceiling: true, renameOnly: true, moveFoldersAndFiles: true, fileBudget: true });
	});

	test('the generated row says a phased plan carries build output between phases, discards it once the sequence passes, and why to set gates.generate', () => {
		const generatedRow = findRow({ key: 'generated' });

		expect(generatedRow).toMatch(
			/^\| `generated` \| no \| .*phased plan.*next phase starts from current build output.*discards them once it passes.*`gates\.generate`.*pre-ship step/,
		);
	});

	test('the commands row is optional and says a resume keeps the recorded harness and takes model and effort from the configuration the run recorded, not the current file', () => {
		const commandsRow = findRow({ key: 'commands' });

		expect(commandsRow).toMatch(
			/^\| `commands` \| no \| .*`resume`.*recorded harness.*\bmodel\b.*\beffort\b.*configuration the run recorded.*\b(?:never|not)\b.*\bfile\b/,
		);
	});

	test('renders a package-standards-packs row as optional', () => {
		const packagePacksRow = findRow({ key: 'package-standards-packs' });

		expect(packagePacksRow).toMatch(/^\| `package-standards-packs` \| no \| \S/);
	});
});
