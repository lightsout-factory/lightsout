import { describe, expect, test } from '@jest/globals';
import { setupSyntaxTreeInput } from '@lightsout/standards-testkit';
import { check } from './check.ts';

describe('type-assertion check', () => {
	test('asks for parsed trees, since only the tree tells a cast from the word `as`', () => {
		expect(check.inputKinds).toStrictEqual(['syntax-tree']);
	});

	test('reports a cast to a keyword type and the line it sits on', async () => {
		const input = setupSyntaxTreeInput({
			sources: [
				[
					'src/payloads/readLabel.ts',
					'export const readLabel = ({ payload }: { payload: Record<string, unknown> }): string => (payload.label as string).toUpperCase();\n',
				],
			],
		});

		const findings = await check.run({ inputs: { 'syntax-tree': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'type-assertion:src/payloads/readLabel.ts',
				files: [{ path: 'src/payloads/readLabel.ts' }],
				detail: '`as` cast at line 1',
				guidance: 'Narrow with `typeof`, `instanceof` or a discriminated union, or write a type guard that tests the value.',
			},
		]);
	});

	test('reports a cast to a named type, which is a reference to something other than `const`', async () => {
		const input = setupSyntaxTreeInput({
			sources: [
				[
					'src/payloads/readKind.ts',
					[
						"import type { PayloadKind } from './common/constants/PayloadKind.ts';",
						'',
						'export const readKind = ({ raw }: { raw: unknown }): PayloadKind => raw as PayloadKind;',
					].join('\n'),
				],
			],
		});

		const findings = await check.run({ inputs: { 'syntax-tree': input }, options: {} });

		expect(findings[0]?.detail).toBe('`as` cast at line 3');
	});

	test('reports a cast to a type read off another namespace, where the name is qualified rather than plain', async () => {
		const input = setupSyntaxTreeInput({
			sources: [
				['src/payloads/readNode.ts', "import type ts from 'typescript';\n\nexport const readNode = ({ raw }: { raw: unknown }): ts.Node => raw as ts.Node;\n"],
			],
		});

		const findings = await check.run({ inputs: { 'syntax-tree': input }, options: {} });

		expect(findings[0]?.detail).toBe('`as` cast at line 3');
	});

	test('reaches a cast buried inside a function body rather than only the ones at the top', async () => {
		const input = setupSyntaxTreeInput({
			sources: [
				[
					'src/payloads/readLabel.ts',
					[
						'export const readLabel = ({ payload }: { payload: Record<string, unknown> }): string => {',
						'\tconst label = payload.label as string;',
						'',
						'\treturn label.toUpperCase();',
						'};',
					].join('\n'),
				],
			],
		});

		const findings = await check.run({ inputs: { 'syntax-tree': input }, options: {} });

		expect(findings[0]?.detail).toBe('`as` cast at line 2');
	});

	test('gathers every cast of one file into one job, since one pass proves the types it works with', async () => {
		const input = setupSyntaxTreeInput({
			sources: [
				[
					'src/payloads/readLabel.ts',
					[
						'export const readLabel = ({ payload }: { payload: Record<string, unknown> }): string => (payload.label as string).toUpperCase();',
						'',
						'export const readCount = ({ payload }: { payload: Record<string, unknown> }): number => payload.count as number;',
					].join('\n'),
				],
			],
		});

		const findings = await check.run({ inputs: { 'syntax-tree': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'type-assertion:src/payloads/readLabel.ts',
				files: [{ path: 'src/payloads/readLabel.ts' }],
				detail: '`as` cast at lines 1, 3',
				guidance: 'Narrow with `typeof`, `instanceof` or a discriminated union, or write a type guard that tests the value.',
			},
		]);
	});

	test('counts both halves of a double cast, since each one is an assertion of its own', async () => {
		const input = setupSyntaxTreeInput({
			sources: [
				[
					'src/payloads/readLabel.ts',
					'export const readLabel = ({ payload }: { payload: Record<string, unknown> }): string => payload.label as unknown as string;\n',
				],
			],
		});

		const findings = await check.run({ inputs: { 'syntax-tree': input }, options: {} });

		expect(findings[0]?.detail).toBe('`as` cast at lines 1, 1');
	});

	test('leaves an `as const`, which freezes literals rather than asserting a type', async () => {
		const input = setupSyntaxTreeInput({
			sources: [
				[
					'src/payloads/common/constants/PayloadKind.ts',
					[
						'export const PayloadKind = {',
						"\tLabel: 'label',",
						"\tAmount: 'amount',",
						'} as const;',
						'',
						'export type PayloadKind = (typeof PayloadKind)[keyof typeof PayloadKind];',
					].join('\n'),
				],
			],
		});

		const findings = await check.run({ inputs: { 'syntax-tree': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('leaves a file that narrows with `typeof` instead of asserting', async () => {
		const input = setupSyntaxTreeInput({
			sources: [
				[
					'src/payloads/readLabel.ts',
					[
						'export const readLabel = ({ payload }: { payload: Record<string, unknown> }): string => {',
						'\tconst label = payload.label;',
						'',
						"\treturn typeof label === 'string' ? label.toUpperCase() : '';",
						'};',
					].join('\n'),
				],
			],
		});

		const findings = await check.run({ inputs: { 'syntax-tree': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('leaves the word alone where it renames an import rather than casting', async () => {
		const input = setupSyntaxTreeInput({
			sources: [
				[
					'src/payloads/readLabel.ts',
					"import { readLabel as readPayloadLabel } from './common/utils/readLabel.ts';\n\nexport const read = ({ payload }: { payload: Record<string, unknown> }): string => readPayloadLabel({ payload });\n",
				],
			],
		});

		const findings = await check.run({ inputs: { 'syntax-tree': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('leaves the word alone where it sits in a string or a comment', async () => {
		const input = setupSyntaxTreeInput({
			sources: [['src/payloads/readLabel.ts', "// treat the value as a label\nexport const readLabel = (): string => 'as string';\n"]],
		});

		const findings = await check.run({ inputs: { 'syntax-tree': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('reports each offending file on its own and passes over the files that are clean', async () => {
		const input = setupSyntaxTreeInput({
			sources: [
				[
					'src/payloads/readAmount.ts',
					"export const readAmount = ({ payload }: { payload: Record<string, unknown> }): number => (typeof payload.amount === 'number' ? payload.amount : 0);\n",
				],
				[
					'src/payloads/readLabel.ts',
					'export const readLabel = ({ payload }: { payload: Record<string, unknown> }): string => (payload.label as string).toUpperCase();\n',
				],
			],
		});

		const findings = await check.run({ inputs: { 'syntax-tree': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'type-assertion:src/payloads/readLabel.ts',
				files: [{ path: 'src/payloads/readLabel.ts' }],
				detail: '`as` cast at line 1',
				guidance: 'Narrow with `typeof`, `instanceof` or a discriminated union, or write a type guard that tests the value.',
			},
		]);
	});

	test.each([
		{ shape: 'an arrow whose expression is true', source: 'export const isUser = (value: unknown): value is User => true;\n' },
		{ shape: 'a body that only returns true', source: 'export const isUser = (value: unknown): value is User => {\n\treturn true;\n};\n' },
		{ shape: 'a function declaration that only returns true', source: 'export function isUser(value: unknown): value is User {\n\treturn true;\n}\n' },
	])('reports a type guard that tests nothing: $shape', async ({ source }) => {
		const input = setupSyntaxTreeInput({ sources: [['src/users/isUser.ts', source]] });

		const findings = await check.run({ inputs: { 'syntax-tree': input }, options: {} });

		expect(findings.map(({ detail }) => detail)).toStrictEqual(['a type guard that tests nothing at line 1']);
	});

	test('leaves a type guard that tests the value', async () => {
		const input = setupSyntaxTreeInput({
			sources: [['src/users/isLabel.ts', "export const isLabel = (value: unknown): value is string => typeof value === 'string';\n"]],
		});

		const findings = await check.run({ inputs: { 'syntax-tree': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('names a cast and an untested guard apart in the one finding a file gets', async () => {
		const input = setupSyntaxTreeInput({
			sources: [
				[
					'src/users/readUser.ts',
					'export const isUser = (value: unknown): value is User => true;\nexport const readName = (value: unknown): string => (value as User).name;\n',
				],
			],
		});

		const findings = await check.run({ inputs: { 'syntax-tree': input }, options: {} });

		expect(findings.map(({ detail }) => detail)).toStrictEqual(['`as` cast at line 2; a type guard that tests nothing at line 1']);
	});

	test('reports nothing when its input is missing rather than refusing', async () => {
		const findings = await check.run({ inputs: {}, options: {} });

		expect(findings).toStrictEqual([]);
	});
});
