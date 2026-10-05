import { describe, expect, test } from '@jest/globals';
import type { FileTextInput } from '@lightsout/standards-contracts';
import { StandardsInputKind } from '@lightsout/standards-contracts';

import { check } from './check.ts';

/**
 * A repo as the engine hands it to a file-text rule: every path in scope, with
 * its text. `listedWithoutText` names paths the run found but never read, so a
 * file can appear in scope with no contents entry behind it.
 */
const setupFileTextInput = ({ contents, listedWithoutText = [] }: { contents: Array<[string, string]>; listedWithoutText?: string[] }): FileTextInput => {
	const files = [...contents.map(([path]) => path), ...listedWithoutText];

	return {
		kind: StandardsInputKind.FileText,
		cwd: '/repo',
		source: files,
		tests: [],
		files,
		referenceFiles: [],
		contents: new Map(contents),
		standardsLibraries: [],
	};
};

describe('multi-export check', () => {
	test('asks for file text, since the verdict is in each file’s own declaration lines', () => {
		expect(check.inputKinds).toStrictEqual(['file-text']);
	});

	test('reports a file holding two unrelated exports, naming both', async () => {
		const input = setupFileTextInput({
			contents: [['src/common/types/Config.ts', ['export interface Config {', '\tname: string;', '}', '', 'export const maxRetries = 3;'].join('\n')]],
		});

		const findings = await check.run({ inputs: { 'file-text': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'multi-export:src/common/types/Config.ts',
				files: [{ path: 'src/common/types/Config.ts' }],
				detail: '2 exports (Config, maxRetries)',
				guidance: 'Give each export its own file, named after it, or stop exporting what only this file uses.',
			},
		]);
	});

	test('judges each file on its own, so one crowded file does not tar its neighbour', async () => {
		const input = setupFileTextInput({
			contents: [
				['src/billing/rate.ts', ['export const baseRate = 1;', 'export const taxRate = 2;'].join('\n')],
				['src/billing/applyRate.ts', 'export const applyRate = (): number => 1;'],
				['src/sync/pushBatch.ts', ['export class PushBatch {}', 'export enum PushState {}', 'export function pushBatch(): void {}'].join('\n')],
			],
		});

		const findings = await check.run({ inputs: { 'file-text': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'multi-export:src/billing/rate.ts',
				files: [{ path: 'src/billing/rate.ts' }],
				detail: '2 exports (baseRate, taxRate)',
				guidance: 'Give each export its own file, named after it, or stop exporting what only this file uses.',
			},
			{
				siteKey: 'multi-export:src/sync/pushBatch.ts',
				files: [{ path: 'src/sync/pushBatch.ts' }],
				detail: '3 exports (PushBatch, PushState, pushBatch)',
				guidance: 'Give each export its own file, named after it, or stop exporting what only this file uses.',
			},
		]);
	});

	test('counts an exported async function, whose declaration carries a keyword before the kind', async () => {
		const input = setupFileTextInput({
			contents: [['src/sync/fetchBatch.ts', ['export async function fetchBatch(): Promise<void> {}', 'export const batchSize = 10;'].join('\n')]],
		});

		const findings = await check.run({ inputs: { 'file-text': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'multi-export:src/sync/fetchBatch.ts',
				files: [{ path: 'src/sync/fetchBatch.ts' }],
				detail: '2 exports (fetchBatch, batchSize)',
				guidance: 'Give each export its own file, named after it, or stop exporting what only this file uses.',
			},
		]);
	});

	test('leaves a file holding a single export alone — the whole point of the rule', async () => {
		const input = setupFileTextInput({
			contents: [['src/common/types/Config.ts', ['export interface Config {', '\tname: string;', '}'].join('\n')]],
		});

		const findings = await check.run({ inputs: { 'file-text': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('leaves a file that exports nothing at all alone', async () => {
		const input = setupFileTextInput({
			contents: [['src/sync/runSync.ts', ['const step = 1;', 'const total = 2;'].join('\n')]],
		});

		const findings = await check.run({ inputs: { 'file-text': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('reads a listed file the run never captured text for as exporting nothing', async () => {
		const input = setupFileTextInput({
			contents: [],
			listedWithoutText: ['src/common/types/Config.ts'],
		});

		const findings = await check.run({ inputs: { 'file-text': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('reads a generator’s interpolated export line as the string it sits in, not a declaration', async () => {
		const input = setupFileTextInput({
			contents: [
				[
					'tools/generateIndexFiles.ts',
					['export const generateIndexFiles = (exportName: string): string => `', "export const ${exportName}: string = '';", '`;'].join('\n'),
				],
			],
		});

		const findings = await check.run({ inputs: { 'file-text': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test.each([
		{ shape: 'named for a test', path: 'src/billing/rate.unit.test.ts' },
		{ shape: 'sitting under a test directory', path: 'tests/helpers/rate.ts' },
	])('spares a file $shape, which the code standards leave to the test standards', async ({ path }) => {
		const input = setupFileTextInput({
			contents: [[path, ['export const baseRate = 1;', 'export const taxRate = 2;'].join('\n')]],
		});

		const findings = await check.run({ inputs: { 'file-text': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('spares an index file, whose job is to list what the module exports', async () => {
		const input = setupFileTextInput({
			contents: [['src/billing/index.ts', ['export const baseRate = 1;', 'export const taxRate = 2;'].join('\n')]],
		});

		const findings = await check.run({ inputs: { 'file-text': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('reports nothing when its input is missing rather than refusing', async () => {
		const findings = await check.run({ inputs: {}, options: {} });

		expect(findings).toStrictEqual([]);
	});
});
