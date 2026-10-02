import { describe, expect, test } from '@jest/globals';
import { setupSyntaxTreeInput, setupTypeCheckerInput } from '@lightsout/standards-testkit';
import { check } from './check.ts';

describe('named-string-values check', () => {
	test('asks for the parsed trees and a type checker: the tree shows a bare union, the checker whether a compared literal is a discriminant', () => {
		expect(check.inputKinds).toStrictEqual(['syntax-tree', 'type-checker']);
	});

	test('reports both halves in one run, the bare union and the literal discriminant, each on its own file', async () => {
		const bare = "export type Mode = 'fast' | 'slow';";
		const sources: Array<[string, string]> = [
			['src/common/constants/Kind.ts', "export const Kind = { Added: 'added' } as const;\n\nexport type Kind = (typeof Kind)[keyof typeof Kind];"],
			['src/common/types/Event.ts', "export interface AddedEvent {\n\tkind: 'added';\n}"],
		];
		const inputs = {
			'syntax-tree': setupSyntaxTreeInput({ sources: [['src/common/types/Mode.ts', bare]] }),
			'type-checker': setupTypeCheckerInput({ sources }),
		};

		const findings = await check.run({ inputs, options: {} });

		expect(findings.map(({ siteKey }) => siteKey)).toStrictEqual([
			'named-string-values:src/common/types/Mode.ts',
			'named-string-values:src/common/types/Event.ts',
		]);
	});

	test('answers nothing when both inputs are missing', async () => {
		const findings = await check.run({ inputs: {}, options: {} });

		expect(findings).toStrictEqual([]);
	});
});
