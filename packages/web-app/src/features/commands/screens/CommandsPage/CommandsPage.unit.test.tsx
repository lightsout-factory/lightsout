import { describe, expect, jest, test } from '@jest/globals';
import type { CommandCatalogEntry } from '@lightsout/engine';
import { CommandGroup, CommandRecordKind } from '@lightsout/engine/contracts';
import { screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryKey } from '#src/common/constants/QueryKey.ts';
import { CommandsPage } from '#src/features/commands/screens/CommandsPage/CommandsPage.tsx';
import { buildCommandCatalogEntry } from '#tests/helpers/buildCommandCatalogEntry.ts';
import { renderWithQueryClient } from '#tests/helpers/renderWithQueryClient.tsx';

// Mocked Imports
// -------------------------
// Each card's name is a link to that command's own page, and a link needs a
// live router to resolve a path. A plain anchor keeps the assertions about
// where the card points rather than about the routing library.
jest.mock('@tanstack/react-router', () => ({
	Link: ({ to, params, children, className }: { to: string; params?: Record<string, string>; children: ReactNode; className?: string }) => (
		<a href={Object.entries(params ?? {}).reduce((path, [name, value]) => path.replace(`$${name}`, value), to)} className={className}>
			{children}
		</a>
	),
}));
// -------------------------

const setupCommandsPage = ({ commands = [buildCommandCatalogEntry()] }: { commands?: CommandCatalogEntry[] } = {}) => {
	renderWithQueryClient({
		ui: <CommandsPage />,
		seed: [{ queryKey: [QueryKey.Commands], data: commands }],
	});
};

/** The cards sitting under one group's heading, by the name each one is titled with. */
const readGroupCards = ({ heading }: { heading: string }): string[] => {
	const section = screen.getByRole('heading', { level: 2, name: heading }).closest('section');

	return Array.from(section?.querySelectorAll('article h3') ?? []).map((title) => title.textContent ?? '');
};

/** The card titled `title`, as the link a reader clicks anywhere on. */
const readCardLink = ({ title }: { title: string }) => screen.getByRole('heading', { level: 3, name: title }).closest('a');

describe('CommandsPage', () => {
	test('names the page and says what a reader will find on it', () => {
		setupCommandsPage();

		expect(screen.getByRole('heading', { level: 1, name: 'Commands' })).toBeInTheDocument();
		expect(screen.getByText(/Every command lightsout offers/)).toBeInTheDocument();
	});

	test('heads the four groups in the order a reader works through them, building before housekeeping', () => {
		setupCommandsPage();

		const headings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);

		expect(headings).toStrictEqual(['Build', 'Burn down', 'Standards', 'Housekeeping']);
	});

	test('files each command under its own group rather than listing them all in one place', () => {
		setupCommandsPage({
			commands: [
				buildCommandCatalogEntry({ id: 'plan', slash: '/plan', group: CommandGroup.Build }),
				buildCommandCatalogEntry({ id: 'doctor', cli: 'lightsout doctor', group: CommandGroup.Housekeeping, overrides: { slash: undefined } }),
				buildCommandCatalogEntry({ id: 'refactor', slash: '/refactor', group: CommandGroup.BurnDown }),
			],
		});

		expect(readGroupCards({ heading: 'Build' })).toStrictEqual(['/plan']);
		expect(readGroupCards({ heading: 'Burn down' })).toStrictEqual(['/refactor']);
		expect(readGroupCards({ heading: 'Standards' })).toStrictEqual([]);
		expect(readGroupCards({ heading: 'Housekeeping' })).toStrictEqual(['doctor']);
	});

	test('keeps the catalog’s own order inside a group, so the page never re-sorts what the engine stated', () => {
		setupCommandsPage({
			commands: [
				buildCommandCatalogEntry({ id: 'plan', slash: '/plan', group: CommandGroup.Build }),
				buildCommandCatalogEntry({ id: 'brainstorm', slash: '/brainstorm', group: CommandGroup.Build }),
				buildCommandCatalogEntry({ id: 'implement', slash: '/implement', group: CommandGroup.Build }),
			],
		});

		const titles = readGroupCards({ heading: 'Build' });

		expect(titles).toStrictEqual(['/plan', '/brainstorm', '/implement']);
	});
});

describe('CommandsPage command cards', () => {
	test('titles a card with the slash form, which is what a reader with the plugin installed would type, and prints the CLI form under it', () => {
		setupCommandsPage({ commands: [buildCommandCatalogEntry({ id: 'refactor', slash: '/refactor', cli: 'lightsout refactor' })] });

		const card = within(screen.getByRole('article'));

		expect({ title: card.getByRole('heading', { level: 3 }).textContent, cli: card.queryByText('lightsout refactor') }).toStrictEqual({
			title: '/refactor',
			cli: expect.anything(),
		});
	});

	test('titles a command the plugin ships no skill for by its bare command word, with the CLI form under it', () => {
		setupCommandsPage({ commands: [buildCommandCatalogEntry({ id: 'doctor', cli: 'lightsout doctor', overrides: { slash: undefined } })] });

		const card = within(screen.getByRole('article'));

		expect({ title: card.getByRole('heading', { level: 3 }).textContent, cli: card.queryByText('lightsout doctor') }).toStrictEqual({
			title: 'doctor',
			cli: expect.anything(),
		});
	});

	test('makes the whole card the link to that command’s own page, addressed by its catalog id rather than its title', () => {
		setupCommandsPage({ commands: [buildCommandCatalogEntry({ id: 'test-coverage-to-threshold', slash: '/test-coverage-to-threshold' })] });

		const link = readCardLink({ title: '/test-coverage-to-threshold' });

		expect(link).toHaveAttribute('href', '/commands/test-coverage-to-threshold');
	});

	test('prints the catalog’s one-line summary, so a reader can choose without opening the page', () => {
		setupCommandsPage({ commands: [buildCommandCatalogEntry({ summary: 'Pick a parked run back up where it stopped.' })] });

		const summary = screen.getByText('Pick a parked run back up where it stopped.');

		expect(summary).toBeInTheDocument();
	});

	test.each([
		{ records: CommandRecordKind.Runs, label: 'Saves a run record' },
		{ records: CommandRecordKind.Plans, label: 'Saves a plan' },
		{ records: CommandRecordKind.Snapshots, label: 'Saves a findings snapshot' },
	])('tags a $records command "$label", which is what it leaves behind', ({ records, label }) => {
		setupCommandsPage({ commands: [buildCommandCatalogEntry({ records })] });

		const tag = within(screen.getByRole('article')).getByText(label);

		expect(tag).toBeInTheDocument();
	});

	test('tags nothing on a command that leaves nothing behind, rather than saying so on most cards', () => {
		setupCommandsPage({ commands: [buildCommandCatalogEntry({ records: CommandRecordKind.Nothing })] });

		const tag = within(screen.getByRole('article')).queryByText(/^Saves /);

		expect(tag).not.toBeInTheDocument();
	});

	test('renders inline code in a summary as code, never as raw backticks', () => {
		setupCommandsPage({ commands: [buildCommandCatalogEntry({ summary: 'Rolls onward per the `auto-plan` config block.' })] });

		const code = within(screen.getByRole('article')).getByText('auto-plan');

		expect({ tag: code.tagName, backticks: screen.queryByText(/`/) }).toStrictEqual({ tag: 'CODE', backticks: null });
	});
});
