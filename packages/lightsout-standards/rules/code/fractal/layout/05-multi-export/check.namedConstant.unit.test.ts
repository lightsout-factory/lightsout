import { describe, expect, test } from '@jest/globals';
import { setupFileTextInput } from '@lightsout/standards-testkit';
import { check } from './check.ts';

// A named constant and the union type derived from it are one export under one
// name; anything else sharing their file is not.

describe('multi-export check', () => {
	test('exempts a named constant and the union derived from it', async () => {
		const input = setupFileTextInput({
			contents: [
				[
					'src/common/constants/SyncState.ts',
					["export const SyncState = { idle: 'idle', busy: 'busy' } as const;", '', 'export type SyncState = (typeof SyncState)[keyof typeof SyncState];'].join(
						'\n',
					),
				],
			],
		});

		const findings = await check.run({ inputs: { 'file-text': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('reports a lookup map keyed by that union, which has its own name and its own users', async () => {
		const input = setupFileTextInput({
			contents: [
				[
					'src/common/constants/SyncState.ts',
					[
						"export const SyncState = { idle: 'idle', busy: 'busy' } as const;",
						'',
						'export type SyncState = (typeof SyncState)[keyof typeof SyncState];',
						'',
						"export const syncStateLabels: Record<SyncState, string> = { idle: 'Idle', busy: 'Busy' };",
					].join('\n'),
				],
			],
		});

		const findings = await check.run({ inputs: { 'file-text': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'multi-export:src/common/constants/SyncState.ts',
				files: [{ path: 'src/common/constants/SyncState.ts' }],
				detail: '3 exports (SyncState, SyncState, syncStateLabels)',
				guidance: 'Give each export its own file, named after it, or stop exporting what only this file uses.',
			},
		]);
	});

	test('reports a type sharing a file with the single value typed by it', async () => {
		const input = setupFileTextInput({
			contents: [
				[
					'src/common/constants/defaultConfig.ts',
					['export interface Config {', '\tname: string;', '}', '', "export const defaultConfig: Config = { name: 'default' };"].join('\n'),
				],
			],
		});

		const findings = await check.run({ inputs: { 'file-text': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'multi-export:src/common/constants/defaultConfig.ts',
				files: [{ path: 'src/common/constants/defaultConfig.ts' }],
				detail: '2 exports (Config, defaultConfig)',
				guidance: 'Give each export its own file, named after it, or stop exporting what only this file uses.',
			},
		]);
	});

	test('reports a named constant whose file also holds an unrelated constant', async () => {
		const input = setupFileTextInput({
			contents: [
				[
					'src/common/constants/SyncState.ts',
					[
						"export const SyncState = { idle: 'idle', busy: 'busy' } as const;",
						'',
						'export type SyncState = (typeof SyncState)[keyof typeof SyncState];',
						'',
						'export const retryLimit = 3;',
					].join('\n'),
				],
			],
		});

		const findings = await check.run({ inputs: { 'file-text': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'multi-export:src/common/constants/SyncState.ts',
				files: [{ path: 'src/common/constants/SyncState.ts' }],
				detail: '3 exports (SyncState, SyncState, retryLimit)',
				guidance: 'Give each export its own file, named after it, or stop exporting what only this file uses.',
			},
		]);
	});

	test('reports a named constant whose file also holds an interface', async () => {
		const input = setupFileTextInput({
			contents: [
				[
					'src/common/constants/SyncState.ts',
					[
						"export const SyncState = { idle: 'idle', busy: 'busy' } as const;",
						'',
						'export type SyncState = (typeof SyncState)[keyof typeof SyncState];',
						'',
						'export interface SyncOptions {',
						'\tretries: number;',
						'}',
					].join('\n'),
				],
			],
		});

		const findings = await check.run({ inputs: { 'file-text': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'multi-export:src/common/constants/SyncState.ts',
				files: [{ path: 'src/common/constants/SyncState.ts' }],
				detail: '3 exports (SyncState, SyncState, SyncOptions)',
				guidance: 'Give each export its own file, named after it, or stop exporting what only this file uses.',
			},
		]);
	});
});
