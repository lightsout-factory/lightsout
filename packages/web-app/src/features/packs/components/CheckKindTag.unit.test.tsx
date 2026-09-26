import { describe, expect, test } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { CheckKind } from '#src/common/constants/CheckKind.ts';
import { CheckKindTag } from '#src/features/packs/components/CheckKindTag.tsx';

describe('CheckKindTag', () => {
	test('names the kind in full by default', () => {
		render(<CheckKindTag kind={CheckKind.Deterministic} />);

		const tag = screen.getByText('Deterministic check');

		expect(tag).toBeInTheDocument();
	});

	test('uses the short name where a row has little room', () => {
		render(<CheckKindTag kind={CheckKind.Agent} isShort />);

		const tag = screen.getByText('Agent');

		expect(tag).toBeInTheDocument();
	});
});
