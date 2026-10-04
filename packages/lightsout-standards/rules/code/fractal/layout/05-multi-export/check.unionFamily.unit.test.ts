import { describe, expect, test } from '@jest/globals';
import { setupFileTextInput } from '@lightsout/standards-testkit';
import { check } from './check.ts';

// A file of member interfaces plus the one union alias built from them is one
// family, not several exports; anything beside that family is not.

describe('multi-export check', () => {
	test('exempts a union family: member interfaces plus the one alias built from them', async () => {
		const input = setupFileTextInput({
			contents: [
				[
					'src/common/types/SyncEvent.ts',
					[
						'export interface FileAddedEvent {',
						"\tkind: 'file-added';",
						'}',
						'',
						'export interface RecordParsedEvent {',
						"\tkind: 'record-parsed';",
						'}',
						'',
						'export type SyncEvent = FileAddedEvent | RecordParsedEvent;',
					].join('\n'),
				],
			],
		});

		const findings = await check.run({ inputs: { 'file-text': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('reports member interfaces carrying a second alias, which is two families in one file', async () => {
		const input = setupFileTextInput({
			contents: [
				[
					'src/common/types/SyncEvent.ts',
					[
						'export interface FileAddedEvent {',
						"\tkind: 'file-added';",
						'}',
						'',
						'export type SyncEvent = FileAddedEvent;',
						"export type SyncEventKind = SyncEvent['kind'];",
					].join('\n'),
				],
			],
		});

		const findings = await check.run({ inputs: { 'file-text': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'multi-export:src/common/types/SyncEvent.ts',
				files: [{ path: 'src/common/types/SyncEvent.ts' }],
				detail: '3 exports (FileAddedEvent, SyncEvent, SyncEventKind)',
				guidance: 'Give each export its own file, named after it, or stop exporting what only this file uses.',
			},
		]);
	});

	test('reports member interfaces sharing the file with an unrelated constant, alias or no alias', async () => {
		const input = setupFileTextInput({
			contents: [
				[
					'src/common/types/SyncEvent.ts',
					[
						'export interface FileAddedEvent {',
						"\tkind: 'file-added';",
						'}',
						'',
						'export type SyncEvent = FileAddedEvent;',
						"export const defaultEvent = 'file-added';",
					].join('\n'),
				],
			],
		});

		const findings = await check.run({ inputs: { 'file-text': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'multi-export:src/common/types/SyncEvent.ts',
				files: [{ path: 'src/common/types/SyncEvent.ts' }],
				detail: '3 exports (FileAddedEvent, SyncEvent, defaultEvent)',
				guidance: 'Give each export its own file, named after it, or stop exporting what only this file uses.',
			},
		]);
	});

	test('reports interfaces with no alias at all — a plain pile of types, not a union family', async () => {
		const input = setupFileTextInput({
			contents: [
				[
					'src/common/types/SyncEvent.ts',
					['export interface FileAddedEvent {', "\tkind: 'file-added';", '}', '', 'export interface RecordParsedEvent {', "\tkind: 'record-parsed';", '}'].join(
						'\n',
					),
				],
			],
		});

		const findings = await check.run({ inputs: { 'file-text': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'multi-export:src/common/types/SyncEvent.ts',
				files: [{ path: 'src/common/types/SyncEvent.ts' }],
				detail: '2 exports (FileAddedEvent, RecordParsedEvent)',
				guidance: 'Give each export its own file, named after it, or stop exporting what only this file uses.',
			},
		]);
	});

	test('exempts a union written one member per line, wherever the alias sits in the file', async () => {
		const input = setupFileTextInput({
			contents: [
				[
					'src/common/types/SyncEvent.ts',
					[
						'export interface FileAddedEvent {',
						"\tkind: 'file-added';",
						'}',
						'',
						'export type SyncEvent =',
						'\t| FileAddedEvent',
						'\t| RecordParsedEvent;',
						'',
						'export interface RecordParsedEvent {',
						"\tkind: 'record-parsed';",
						'}',
					].join('\n'),
				],
			],
		});

		const findings = await check.run({ inputs: { 'file-text': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('reports interfaces beside an alias that is not a union of them', async () => {
		const input = setupFileTextInput({
			contents: [
				[
					'src/common/types/SyncEvent.ts',
					[
						'export interface FileAddedEvent {',
						"\tkind: 'file-added';",
						'}',
						'',
						'export interface RecordParsedEvent {',
						"\tkind: 'record-parsed';",
						'}',
						'',
						"export type SyncEventKind = 'file-added' | 'record-parsed';",
					].join('\n'),
				],
			],
		});

		const findings = await check.run({ inputs: { 'file-text': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'multi-export:src/common/types/SyncEvent.ts',
				files: [{ path: 'src/common/types/SyncEvent.ts' }],
				detail: '3 exports (FileAddedEvent, RecordParsedEvent, SyncEventKind)',
				guidance: 'Give each export its own file, named after it, or stop exporting what only this file uses.',
			},
		]);
	});

	test('reports a union that leaves one of the file’s interfaces out', async () => {
		const input = setupFileTextInput({
			contents: [
				[
					'src/common/types/SyncEvent.ts',
					[
						'export interface FileAddedEvent {',
						"\tkind: 'file-added';",
						'}',
						'',
						'export interface SyncOptions {',
						'\tretries: number;',
						'}',
						'',
						'export type SyncEvent = FileAddedEvent | RecordParsedEvent;',
					].join('\n'),
				],
			],
		});

		const findings = await check.run({ inputs: { 'file-text': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'multi-export:src/common/types/SyncEvent.ts',
				files: [{ path: 'src/common/types/SyncEvent.ts' }],
				detail: '3 exports (FileAddedEvent, SyncOptions, SyncEvent)',
				guidance: 'Give each export its own file, named after it, or stop exporting what only this file uses.',
			},
		]);
	});
});
