import { describe, expect, test } from '@jest/globals';
import ts from 'typescript';
import { readDeclaredExports } from '#src/plan/evidence/readDeclaredExports.ts';

const read = ({ path = 'src/billing/rates.ts', content }: { path?: string; content: string }) => readDeclaredExports({ path, content, compiler: ts });

describe('readDeclaredExports', () => {
	test('reads every name a file declares and exports, whatever the file is called', () => {
		const names = read({
			content: [
				'export const baseRate = 1, taxRate = 2;',
				'export function applyRate() {}',
				'export class RateTable {}',
				'export interface Rate {}',
				'export type RateId = string;',
				'export enum RateKind { Flat }',
				'export const { discount, surcharge: extra } = rates;',
				'const internal = 3;',
			].join('\n'),
		});

		expect(names).toStrictEqual(['baseRate', 'taxRate', 'applyRate', 'RateTable', 'Rate', 'RateId', 'RateKind', 'discount', 'extra']);
	});

	test('counts a local export list, but never a re-export — that name belongs to the file it comes from', () => {
		const names = read({ content: "const local = 1;\nexport { local };\nexport { borrowed } from './elsewhere';\nexport * from './all';" });

		expect(names).toStrictEqual(['local']);
	});

	test('a file that only re-exports declares nothing', () => {
		expect(read({ path: 'src/billing/index.ts', content: "export { baseRate } from './rates';\nexport * from './table';" })).toStrictEqual([]);
	});

	test('an unnamed default export has no name to search by', () => {
		expect(read({ content: 'export default function () {}\nexport default 3;' })).toStrictEqual([]);
	});

	test('reads JSX files too', () => {
		expect(read({ path: 'src/RateView.tsx', content: 'export const RateView = () => <div />;' })).toStrictEqual(['RateView']);
	});
});
