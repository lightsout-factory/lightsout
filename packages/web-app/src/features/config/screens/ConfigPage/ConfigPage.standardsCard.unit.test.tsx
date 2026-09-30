import { describe, expect, jest, test } from '@jest/globals';
import type { ConfigView } from '@lightsout/engine';
import { StandardsPackSource } from '@lightsout/engine/contracts';
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
// pack each group of packages uses, and how that pack was chosen.
describe('ConfigPage packs card', () => {
	test('points the pack in use at the Standards Packs page, which is where what it says lives', () => {
		setupConfigPage({
			overrides: { standardsGroups: [{ packages: [''], appliesTo: 'repo root (outside packages)', pack: 'acme/house', source: StandardsPackSource.Named }] },
		});

		const link = screen.getByRole('link', { name: 'acme/house' });

		expect(link).toHaveAttribute('href', '/standards-packs');
	});

	test('marks the pack lightsout detected when the config names none', () => {
		setupConfigPage({
			overrides: {
				standardsGroups: [{ packages: [''], appliesTo: 'repo root (outside packages)', pack: 'lightsout/node', source: StandardsPackSource.Detected }],
			},
		});

		const card = screen.getByRole('heading', { level: 3, name: 'Standards pack in use' }).closest('section');

		expect(within(card as HTMLElement).getByText('detected')).toBeInTheDocument();
	});

	test('speaks a named pack and a detected one in different tones, so a reader tells a choice from a guess at a glance', () => {
		setupConfigPage({
			overrides: {
				standardsGroups: [
					{ packages: [''], appliesTo: 'repo root (outside packages)', pack: 'acme/house', source: StandardsPackSource.Named },
					{ packages: ['api'], appliesTo: 'api', pack: 'lightsout/node', source: StandardsPackSource.Detected },
				],
				ruleStates: [],
			},
		});

		const tones = [screen.getByText('named'), screen.getByText('detected')].map((badge) => badge.className);

		expect(tones[0]).toContain('bg-[image:var(--brand-gradient)]');
		expect(tones[1]).toContain('text-muted-foreground-strong');
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
				{ packages: ['', 'api'], appliesTo: 'repo root (outside packages), api', pack: 'lightsout/node', source: StandardsPackSource.Detected },
			],
			expected: { href: '/standards-packs', badge: 'detected', coversRepoRoot: true, coversApi: true, announcesNone: false },
		},
		{
			standardsGroups: [{ packages: [''], appliesTo: 'repo root (outside packages)', pack: 'lightsout/node', source: StandardsPackSource.Named }],
			expected: { href: '/standards-packs', badge: 'named', coversRepoRoot: true, coversApi: false, announcesNone: false },
		},
		{
			standardsGroups: [],
			expected: { href: null, badge: null, coversRepoRoot: false, coversApi: false, announcesNone: true },
		},
	])('ConfigPage: the standards card shows the pack in use, how it was chosen and what it covers', ({ standardsGroups, expected }) => {
		setupConfigPage({ overrides: { standardsGroups, ruleStates: [] } });

		const link = screen.queryByRole('link', { name: 'lightsout/node' });
		const badge = screen.queryByText(/^(named|detected)$/);
		const pageText = document.body.textContent ?? '';

		expect({
			href: link?.getAttribute('href') ?? null,
			badge: badge?.textContent ?? null,
			coversRepoRoot: /repo root/i.test(pageText),
			coversApi: /\bapi\b/.test(pageText),
			announcesNone: /standards-pack\b[^.]*false/.test(pageText),
		}).toStrictEqual(expected);
	});

	test.each([
		{
			standardsGroups: [
				{ packages: ['', 'engine'], appliesTo: 'repo root (outside packages), engine', pack: 'lightsout/node', source: StandardsPackSource.Named },
				{ packages: ['web-app'], appliesTo: 'web-app', pack: 'lightsout/tanstack-start-app', source: StandardsPackSource.Detected },
			],
			expected: {
				rows: [
					{ pack: 'lightsout/node', badge: 'named', namesItsPackages: true, namesRepoRoot: true },
					{ pack: 'lightsout/tanstack-start-app', badge: 'detected', namesItsPackages: true, namesRepoRoot: false },
				],
				showsEmptyState: false,
			},
		},
		{
			standardsGroups: [],
			expected: { rows: [], showsEmptyState: true },
		},
	])('draws one row per standards group, naming its pack, whether it was named or detected, and the packages it covers', ({ standardsGroups, expected }) => {
		setupConfigPage({ overrides: { standardsGroups, ruleStates: [] } });

		const card = screen.getByRole('heading', { level: 3, name: 'Standards pack in use' }).closest('section') as HTMLElement;
		const rows = within(card)
			.queryAllByRole('link')
			.map((link, index) => {
				const row = link.parentElement as HTMLElement;
				const rowText = row.textContent ?? '';

				return {
					pack: link.textContent,
					badge: within(row).getByText(/^(named|detected)$/).textContent,
					namesItsPackages: rowText.includes(standardsGroups[index].appliesTo),
					namesRepoRoot: /repo root/.test(rowText),
				};
			});
		const showsEmptyState = /no standards/i.test(card.textContent ?? '');

		expect({ rows, showsEmptyState }).toStrictEqual(expected);
	});
});
