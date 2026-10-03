import { describe, expect, jest, test } from '@jest/globals';
import type { ConfigView } from '@lightsout/engine';
import { screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryKey } from '#src/common/constants/QueryKey.ts';
import { ConfigPage } from '#src/features/config/screens/ConfigPage/ConfigPage.tsx';
import { buildConfigView } from '#tests/helpers/buildConfigView.ts';
import { renderWithQueryClient } from '#tests/helpers/renderWithQueryClient.tsx';

// Mocked Imports
// -------------------------
// Every pack and every rule on this page is a link into the pack pages, and a
// link needs a live router to resolve a path. A plain anchor keeps the
// assertions about where a row points rather than about the routing library.
jest.mock('@tanstack/react-router', () => ({
	Link: ({ to, params, children, className }: { to: string; params?: Record<string, string>; children: ReactNode; className?: string }) => (
		<a href={Object.entries(params ?? {}).reduce((path, [name, value]) => path.replace(`$${name}`, value), to)} className={className}>
			{children}
		</a>
	),
}));
// -------------------------

const setupConfigPage = ({ overrides = {} }: { overrides?: Partial<ConfigView> } = {}) => {
	renderWithQueryClient({ ui: <ConfigPage />, seed: [{ queryKey: [QueryKey.Config], data: buildConfigView({ overrides }) }] });
};

// Split from the page's own suite by concern: the card naming the standards
// packs each group of packages uses, and the conditional packs that applied.
describe('ConfigPage packs card', () => {
	test('points the pack in use at the Standards Packs page, which is where what it says lives', () => {
		setupConfigPage({
			overrides: { standardsGroups: [{ packages: [''], appliesTo: 'repo root (outside packages)', pack: 'acme/house', conditionalPacks: [] }] },
		});

		const link = screen.getByRole('link', { name: 'acme/house' });

		expect(link).toHaveAttribute('href', '/standards-packs');
	});

	test('names each conditional pack the packages’ dependencies brought in', () => {
		setupConfigPage({
			overrides: {
				standardsGroups: [
					{
						packages: ['web-app'],
						appliesTo: 'web-app',
						pack: 'lightsout/standards',
						conditionalPacks: ['lightsout/react', 'lightsout/tanstack-start'],
					},
				],
			},
		});

		const card = screen.getByRole('heading', { level: 3, name: 'Standards pack in use' }).closest('section');
		const badges = within(card as HTMLElement)
			.getAllByText(/^with /)
			.map((badge) => badge.textContent);

		expect(badges).toStrictEqual(['with lightsout/react', 'with lightsout/tanstack-start']);
	});

	test('says plainly that no standards load here, rather than showing an empty card', () => {
		setupConfigPage({ overrides: { standardsGroups: [] } });

		const notice = screen.getByText(/No standards load here/);

		expect(notice).toBeInTheDocument();
	});
});

describe('ConfigPage standards card', () => {
	test.each([
		{
			standardsGroups: [
				{ packages: ['', 'api'], appliesTo: 'repo root (outside packages), api', pack: 'lightsout/standards', conditionalPacks: ['lightsout/tanstack-start'] },
			],
			expected: { href: '/standards-packs', badge: 'with lightsout/tanstack-start', coversRepoRoot: true, coversApi: true, announcesNone: false },
		},
		{
			standardsGroups: [{ packages: [''], appliesTo: 'repo root (outside packages)', pack: 'lightsout/standards', conditionalPacks: [] }],
			expected: { href: '/standards-packs', badge: null, coversRepoRoot: true, coversApi: false, announcesNone: false },
		},
		{
			standardsGroups: [],
			expected: { href: null, badge: null, coversRepoRoot: false, coversApi: false, announcesNone: true },
		},
	])('ConfigPage: the standards card shows the pack in use, the conditional packs that applied and what it covers', ({ standardsGroups, expected }) => {
		setupConfigPage({ overrides: { standardsGroups, ruleStates: [] } });

		const link = screen.queryByRole('link', { name: 'lightsout/standards' });
		const badge = screen.queryByText(/^with /);
		const pageText = document.body.textContent ?? '';

		expect({
			href: link?.getAttribute('href') ?? null,
			badge: badge?.textContent ?? null,
			coversRepoRoot: /repo root/i.test(pageText),
			coversApi: /\bapi\b/.test(pageText),
			announcesNone: /No standards load here/.test(pageText),
		}).toStrictEqual(expected);
	});

	test.each([
		{
			standardsGroups: [
				{ packages: ['', 'engine'], appliesTo: 'repo root (outside packages), engine', pack: 'lightsout/standards', conditionalPacks: [] },
				{ packages: ['web-app'], appliesTo: 'web-app', pack: 'lightsout/standards', conditionalPacks: ['lightsout/react'] },
			],
			expected: {
				rows: [
					{ pack: 'lightsout/standards', badges: [], namesItsPackages: true, namesRepoRoot: true },
					{ pack: 'lightsout/standards', badges: ['with lightsout/react'], namesItsPackages: true, namesRepoRoot: false },
				],
				showsEmptyState: false,
			},
		},
		{
			standardsGroups: [],
			expected: { rows: [], showsEmptyState: true },
		},
	])('draws one row per standards group, naming its pack, its conditional packs and the packages it covers', ({ standardsGroups, expected }) => {
		setupConfigPage({ overrides: { standardsGroups, ruleStates: [] } });

		const card = screen.getByRole('heading', { level: 3, name: 'Standards pack in use' }).closest('section') as HTMLElement;
		const rows = within(card)
			.queryAllByRole('link')
			.map((link, index) => {
				const row = link.parentElement as HTMLElement;
				const rowText = row.textContent ?? '';

				return {
					pack: link.textContent,
					badges: within(row)
						.queryAllByText(/^with /)
						.map((badge) => badge.textContent),
					namesItsPackages: rowText.includes(standardsGroups[index].appliesTo),
					namesRepoRoot: /repo root/.test(rowText),
				};
			});
		const showsEmptyState = /no standards/i.test(card.textContent ?? '');

		expect({ rows, showsEmptyState }).toStrictEqual(expected);
	});
});
