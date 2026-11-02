import { describe, expect, jest, test } from '@jest/globals';
import type { ConfigView, FrictionRecord, PlanWorkspaceListing, StandardsView } from '@lightsout/engine';
import { screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { RepoHealthScreen } from '#src/repo/RepoHealthScreen/RepoHealthScreen.tsx';
import { runsQueryOptions } from '#src/runs/runsQueryOptions.ts';
import { repoRootQueryOptions } from '#src/shell/repoRootQueryOptions.ts';
import { standardsQueryOptions } from '#src/standards/standardsQueryOptions.ts';
import { buildRunListing } from '#tests/helpers/buildRunListing.ts';
import { buildStandardsRuleView } from '#tests/helpers/buildStandardsRuleView.ts';
import { buildStandardsView } from '#tests/helpers/buildStandardsView.ts';
import { renderWithQueryClient } from '#tests/helpers/renderWithQueryClient.tsx';

// Mocked Imports
// -------------------------
// Standards, friction, config and plans reach this page through `useQuery`, so
// an unseeded one of them would run its real server function and read the
// filesystem. Every query but the standards is left hanging here: the panel
// under test reads the standards alone, and the rest of the page renders
// without the others.
const mockGetStandards = jest.fn<() => Promise<StandardsView>>();
const mockGetFriction = jest.fn<() => Promise<FrictionRecord[]>>();
const mockGetConfig = jest.fn<() => Promise<ConfigView>>();
const mockListPlans = jest.fn<() => Promise<PlanWorkspaceListing[]>>();

jest.mock('#src/common/server/getReader/getReader.ts', () => ({
	getReader: () => ({
		getStandards: () => mockGetStandards(),
		getFriction: () => mockGetFriction(),
		getConfig: () => mockGetConfig(),
		listPlanWorkspaces: () => mockListPlans(),
	}),
}));
// -------------------------
jest.mock('@tanstack/react-router', () => ({
	Link: ({ to, search, children, className }: { to: string; search?: Record<string, string>; children: ReactNode; className?: string }) => {
		const query = new URLSearchParams(search ?? {}).toString();

		return (
			<a href={query === '' ? to : `${to}?${query}`} className={className}>
				{children}
			</a>
		);
	},
}));
// -------------------------

/** A query that never answers — how this file holds a subscription the page is built to render without. */
const neverAnswers = <TData,>(): Promise<TData> => new Promise<TData>(() => {});

/** `null` leaves the standards query pending, which is a repo that has never run a check. */
const setupRepoHealth = ({ standards }: { standards: StandardsView | null }) => {
	mockGetStandards.mockReturnValue(neverAnswers());
	mockGetFriction.mockReturnValue(neverAnswers());
	mockGetConfig.mockReturnValue(neverAnswers());
	mockListPlans.mockReturnValue(neverAnswers());

	renderWithQueryClient({
		ui: <RepoHealthScreen />,
		seed: [
			{ queryKey: repoRootQueryOptions().queryKey, data: { repoRoot: '/repos/lightsout' } },
			{ queryKey: runsQueryOptions().queryKey, data: [buildRunListing()] },
			...(standards === null ? [] : [{ queryKey: standardsQueryOptions().queryKey, data: standards }]),
		],
	});
};

/** The bars, read inside their own panel, since every other link on the page is a run. */
const readTopRules = () =>
	within(screen.getByRole('heading', { level: 3, name: 'Top rules by findings' }).closest('section') as HTMLElement)
		.queryAllByRole('link')
		.map((link) => ({ rule: link.firstElementChild?.textContent, count: link.lastElementChild?.textContent, href: link.getAttribute('href') }));

describe('RepoHealthScreen top rules panel', () => {
	test('is not mounted at all while no check has answered, rather than drawing an empty panel', () => {
		setupRepoHealth({ standards: null });

		const heading = screen.queryByRole('heading', { name: 'Top rules by findings' });

		expect(heading).not.toBeInTheDocument();
	});

	test('ranks the rules a repo is breaking most, worst first', () => {
		setupRepoHealth({
			standards: buildStandardsView({
				overrides: {
					rules: [
						buildStandardsRuleView({ rule: 'loose-file', findingCount: 3 }),
						buildStandardsRuleView({ rule: 'file-size', findingCount: 11 }),
						buildStandardsRuleView({ rule: 'naming-boolean', findingCount: 7 }),
					],
				},
			}),
		});

		const bars = readTopRules();

		expect(bars.map((bar) => bar.rule)).toStrictEqual(['file-size', 'naming-boolean', 'loose-file']);
		expect(bars.map((bar) => bar.count)).toStrictEqual(['11 findings', '7 findings', '3 findings']);
	});

	test('orders two rules tied on count by name, so the same check always draws the same bars', () => {
		setupRepoHealth({
			standards: buildStandardsView({
				overrides: {
					rules: [buildStandardsRuleView({ rule: 'loose-file', findingCount: 4 }), buildStandardsRuleView({ rule: 'file-size', findingCount: 4 })],
				},
			}),
		});

		const bars = readTopRules();

		expect(bars.map((bar) => bar.rule)).toStrictEqual(['file-size', 'loose-file']);
	});

	test('holds that ranking to five, however many rules a repo breaks', () => {
		setupRepoHealth({
			standards: buildStandardsView({
				overrides: { rules: Array.from({ length: 8 }, (_, index) => buildStandardsRuleView({ rule: `rule-${index}`, findingCount: index + 1 })) },
			}),
		});

		const bars = readTopRules();

		expect(bars).toHaveLength(5);
	});

	test('points a bar at the findings table, already narrowed to the rule it counted', () => {
		setupRepoHealth({ standards: buildStandardsView({ overrides: { rules: [buildStandardsRuleView({ rule: 'file-size', findingCount: 4 })] } }) });

		const [bar] = readTopRules();

		expect(bar.href).toBe('/app/standards?rule=file-size');
	});

	test('says a check came back clean rather than drawing five bars of nothing', () => {
		setupRepoHealth({
			standards: buildStandardsView({
				overrides: { rules: [buildStandardsRuleView({ rule: 'file-size', findingCount: 0 }), buildStandardsRuleView({ rule: 'loose-file', findingCount: 0 })] },
			}),
		});

		expect(screen.getByText('No findings.')).toBeInTheDocument();
		expect(readTopRules()).toStrictEqual([]);
	});
});
