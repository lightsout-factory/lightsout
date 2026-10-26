import { describe, expect, test } from '@jest/globals';
import { StandardsInputKind } from '@lightsout/standards-contracts';
import { selectInputKinds } from '#src/standardsCheck/common/selectInputKinds.ts';

describe('selectInputKinds', () => {
	test('builds every required kind and every optional kind when a typescript is at hand', () => {
		const kinds = selectInputKinds({
			inputKinds: [StandardsInputKind.CloneSpans],
			optionalInputKinds: [StandardsInputKind.SyntaxTree, StandardsInputKind.FileText],
			hasTypescript: true,
		});

		expect(kinds).toStrictEqual([StandardsInputKind.CloneSpans, StandardsInputKind.SyntaxTree, StandardsInputKind.FileText]);
	});

	test('leaves out an optional kind that needs the missing typescript, and keeps one that does not', () => {
		const kinds = selectInputKinds({
			inputKinds: [StandardsInputKind.CloneSpans],
			optionalInputKinds: [StandardsInputKind.SyntaxTree, StandardsInputKind.FileText],
			hasTypescript: false,
		});

		expect(kinds).toStrictEqual([StandardsInputKind.CloneSpans, StandardsInputKind.FileText]);
	});

	test('never drops a required kind — refusing a check that cannot run is for the caller to report', () => {
		const kinds = selectInputKinds({ inputKinds: [StandardsInputKind.SyntaxTree], hasTypescript: false });

		expect(kinds).toStrictEqual([StandardsInputKind.SyntaxTree]);
	});
});
