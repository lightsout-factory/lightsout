import { describe, expect, test } from '@jest/globals';
import type { StandardsPackView } from '@lightsout/engine';
import { render, screen } from '@testing-library/react';
import { PackStats } from '#src/features/home/screens/Home/internal/components/StandardsPacksSection/internal/components/PackStats.tsx';
import { buildStandardsPackView } from '#tests/helpers/buildStandardsPackView.ts';

/** The bundled library's view with only its totals filled; the stats read nothing else. */
const buildLibraryView = ({ totals }: { totals: StandardsPackView['totals'] }): StandardsPackView => ({
	name: 'lightsout',
	rootPath: 'packages/lightsout-standards',
	built: false,
	totals,
	packs: [],
	topics: [],
	rules: [],
});

describe('PackStats', () => {
	test('counts each kind of rule from the pack', () => {
		render(
			<PackStats
				library={buildStandardsPackView({ overrides: { totals: { rules: 112, deterministic: 53, agent: 59, topics: 24, packs: 10, withFixtures: 112 } } })}
			/>,
		);

		expect(screen.getByText('53').parentElement).toHaveTextContent('53 deterministic checks');
	});

	test('still names both kinds before the pack answers, rather than showing a guessed number', () => {
		const { container } = render(<PackStats />);

		expect(container).toHaveTextContent('Deterministic checksAgent checks');
	});

	test('counts the rules of the whole library', () => {
		render(<PackStats library={buildLibraryView({ totals: { rules: 112, deterministic: 53, agent: 59, topics: 24, packs: 10, withFixtures: 112 } })} />);

		const headline = screen.getByText('112');
		const deterministic = screen.getByText('53').parentElement;
		const agent = screen.getByText('59').parentElement;

		expect(headline).toHaveTextContent(/^112 .*lightsout library/i);
		expect(headline).not.toHaveTextContent(/pack/i);
		expect(deterministic).toHaveTextContent('53 deterministic checks');
		expect(agent).toHaveTextContent('59 agent checks');
	});
});
