import { describe, expect, test } from '@jest/globals';
import { setupFileTextInput } from '@lightsout/standards-testkit';
import { check } from './check.ts';

/** A repo as the engine hands it to a file-text rule, with the test files held out of the scope it judges. */
const setupRepo = ({ contents, tests = [] }: { contents: Array<[string, string]>; tests?: string[] }) => {
	return setupFileTextInput({ contents, tests, source: contents.map(([path]) => path).filter((path) => !tests.includes(path)) });
};

/** A file the engine listed in scope but whose text it could not read, so `contents` holds no entry for it. */
const setupUnreadableFileInput = ({ path }: { path: string }) => {
	return setupFileTextInput({ files: [path], source: [path] });
};

describe('filename-mismatch check', () => {
	test('asks for file text, since the export it compares against is inside the file', () => {
		expect(check.inputKinds).toStrictEqual(['file-text']);
	});

	test('reports a file whose only export is called something else', async () => {
		const input = setupRepo({ contents: [['src/billing/chargeLabel.ts', 'export const getChargeLabel = (): number => 1;']] });

		const findings = await check.run({ inputs: { 'file-text': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'filename-mismatch:src/billing/chargeLabel.ts',
				files: [{ path: 'src/billing/chargeLabel.ts' }],
				detail: "file 'chargeLabel' exports 'getChargeLabel'",
				guidance: 'Name the file exactly as its export, casing included.',
			},
		]);
	});

	test('accepts a file named after its export', async () => {
		const input = setupRepo({ contents: [['src/billing/getChargeLabel.ts', 'export const getChargeLabel = (): number => 1;']] });

		const findings = await check.run({ inputs: { 'file-text': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('accepts a PascalCase file named after the class or component it exports', async () => {
		const input = setupRepo({ contents: [['src/components/UserProfile.tsx', 'export const UserProfile = (): null => null;']] });

		const findings = await check.run({ inputs: { 'file-text': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test.each([
		{ path: 'src/billing/getchargelabel.ts', fileName: 'getchargelabel', shape: 'a different casing' },
		{ path: 'src/billing/get-charge-label.ts', fileName: 'get-charge-label', shape: 'kebab-case' },
		{ path: 'src/billing/getChargeLabel.service.ts', fileName: 'getChargeLabel.service', shape: 'a dotted suffix' },
	])('reports a file named after its export in $shape', async ({ path, fileName }) => {
		const input = setupRepo({ contents: [[path, 'export const getChargeLabel = (): number => 1;']] });

		const findings = await check.run({ inputs: { 'file-text': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: `filename-mismatch:${path}`,
				files: [{ path }],
				detail: `file '${fileName}' exports 'getChargeLabel'`,
				guidance: 'Name the file exactly as its export, casing included.',
			},
		]);
	});

	test.each([
		{ path: 'src/sync/SyncEvent.ts', expected: [] },
		{
			path: 'src/sync/FileAddedEvent.ts',
			expected: [
				{
					siteKey: 'filename-mismatch:src/sync/FileAddedEvent.ts',
					files: [{ path: 'src/sync/FileAddedEvent.ts' }],
					detail: "file 'FileAddedEvent' exports 'SyncEvent'",
					guidance: 'Name the file exactly as its export, casing included.',
				},
			],
		},
	])('holds a union and its member types to the union’s name: $path', async ({ path, expected }) => {
		const input = setupRepo({
			contents: [
				[
					path,
					['export interface FileAddedEvent {', "\tkind: 'file-added';", '}', '', 'export type SyncEvent = FileAddedEvent | RecordParsedEvent;'].join('\n'),
				],
			],
		});

		const findings = await check.run({ inputs: { 'file-text': input }, options: {} });

		expect(findings).toStrictEqual(expected);
	});

	test.each([
		{ path: 'src/sync/SyncState.ts', expected: [] },
		{
			path: 'src/sync/syncStates.ts',
			expected: [
				{
					siteKey: 'filename-mismatch:src/sync/syncStates.ts',
					files: [{ path: 'src/sync/syncStates.ts' }],
					detail: "file 'syncStates' exports 'SyncState'",
					guidance: 'Name the file exactly as its export, casing included.',
				},
			],
		},
	])('holds a constant object and its derived type to their one name: $path', async ({ path, expected }) => {
		const input = setupRepo({
			contents: [
				[path, ["export const SyncState = { idle: 'idle' } as const;", 'export type SyncState = (typeof SyncState)[keyof typeof SyncState];'].join('\n')],
			],
		});

		const findings = await check.run({ inputs: { 'file-text': input }, options: {} });

		expect(findings).toStrictEqual(expected);
	});

	test('stays silent on a file holding two unrelated exports, which the one-export-per-file rule owns', async () => {
		const input = setupRepo({
			contents: [['src/config/config.ts', ['export interface Config {', '\tname: string;', '}', '', 'export const defaultConfig = { name: 1 };'].join('\n')]],
		});

		const findings = await check.run({ inputs: { 'file-text': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('stays silent on a file whose text the engine could not read', async () => {
		const input = setupUnreadableFileInput({ path: 'src/billing/chargeLabel.ts' });

		const findings = await check.run({ inputs: { 'file-text': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('stays silent on a file that exports no declaration of its own', async () => {
		const input = setupRepo({ contents: [['src/billing/chargeLabel.ts', "export { getChargeLabel } from '@/billing/getChargeLabel';"]] });

		const findings = await check.run({ inputs: { 'file-text': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('ignores a barrel, which declares nothing of its own', async () => {
		const input = setupRepo({ contents: [['src/billing/index.ts', 'export const getChargeLabel = (): number => 1;']] });

		const findings = await check.run({ inputs: { 'file-text': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('ignores a test file, which the test standards name after its subject', async () => {
		const input = setupRepo({
			contents: [['src/billing/getChargeLabel.unit.test.ts', 'export const setupCharge = (): number => 1;']],
			tests: ['src/billing/getChargeLabel.unit.test.ts'],
		});

		const findings = await check.run({ inputs: { 'file-text': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('reports nothing when its input is missing rather than refusing', async () => {
		const findings = await check.run({ inputs: {}, options: {} });

		expect(findings).toStrictEqual([]);
	});
});
