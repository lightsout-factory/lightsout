import { describe, expect, jest, test } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { RuleNeighbours } from '#src/features/packs/components/RuleNeighbours.tsx';
import { buildStandardsPackRuleListing } from '#tests/helpers/buildStandardsPackRuleListing.ts';

// Mocked Imports
// -------------------------
// A link needs a live router around it; an anchor carrying the resolved address
// is all these tests read.
jest.mock('@tanstack/react-router', () => ({
	Link: ({ to, params, children }: { to: string; params?: Record<string, string>; children: ReactNode }) => (
		<a href={Object.entries(params ?? {}).reduce((path, [name, value]) => path.replace(`$${name}`, value), to)}>{children}</a>
	),
}));
// -------------------------

describe('RuleNeighbours', () => {
	test('links the rule before and the rule after, each under the library both belong to', () => {
		render(
			<RuleNeighbours
				library="lightsout"
				previous={buildStandardsPackRuleListing({ id: 'file-size' })}
				next={buildStandardsPackRuleListing({ id: 'function-size' })}
			/>,
		);

		const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'));

		expect(hrefs).toStrictEqual(['/standards-packs/lightsout/rules/file-size', '/standards-packs/lightsout/rules/function-size']);
	});

	test('links only the rule before on the last rule of a library', () => {
		render(<RuleNeighbours library="lightsout" previous={buildStandardsPackRuleListing({ id: 'file-size' })} />);

		const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'));

		expect(hrefs).toStrictEqual(['/standards-packs/lightsout/rules/file-size']);
	});

	test('renders nothing for a rule with no neighbours', () => {
		const { container } = render(<RuleNeighbours library="lightsout" />);

		expect(container).toBeEmptyDOMElement();
	});
});
