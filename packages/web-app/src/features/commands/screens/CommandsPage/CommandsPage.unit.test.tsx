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

/** The titles listed under one section — Skills or CLI — in page order. */
const readSectionTitles = ({ section }: { section: string }): string[] =>
	Array.from(screen.getByRole('region', { name: section }).querySelectorAll('li h3, li h4')).map((title) => title.textContent ?? '');

/** The CLI group sub-headings, in page order. */
const readCliGroups = (): string[] =>
	within(screen.getByRole('region', { name: 'CLI' }))
		.getAllByRole('heading', { level: 3 })
		.map((heading) => heading.textContent ?? '');

/** The row titled `title`, as the link a reader clicks anywhere on. */
const readRowLink = ({ title }: { title: string }) => screen.getByText(title, { selector: 'h3, h4' }).closest('a');

const cliOnly = ({ id, group = CommandGroup.Housekeeping }: { id: string; group?: CommandGroup }) =>
	buildCommandCatalogEntry({ id, cli: `lightsout ${id}`, group, overrides: { slash: undefined } });

describe('CommandsPage', () => {
	test('names the page and says what a reader will find on it', () => {
		setupCommandsPage();

		expect(screen.getByRole('heading', { level: 1, name: 'Commands' })).toBeInTheDocument();
		expect(screen.getByText(/Every command lightsout offers/)).toBeInTheDocument();
	});

	test('lists skills first and terminal commands after, each under its own heading', () => {
		setupCommandsPage();

		const headings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);

		expect(headings).toStrictEqual(['Skills', 'CLI']);
	});

	test('lists a command the plugin ships a skill for under Skills, once, even when it also has a CLI form', () => {
		setupCommandsPage({
			commands: [buildCommandCatalogEntry({ id: 'implement', slash: '/implement', cli: 'lightsout implement' }), cliOnly({ id: 'doctor' })],
		});

		expect({ skills: readSectionTitles({ section: 'Skills' }), cli: readSectionTitles({ section: 'CLI' }) }).toStrictEqual({
			skills: ['/implement'],
			cli: ['lightsout doctor'],
		});
	});

	test('files each terminal command under its group, in the order a reader works through them, leaving out a group with none', () => {
		setupCommandsPage({
			commands: [cliOnly({ id: 'doctor', group: CommandGroup.Housekeeping }), cliOnly({ id: 'resume', group: CommandGroup.Build })],
		});

		expect(readCliGroups()).toStrictEqual(['Build', 'Housekeeping']);
	});

	test('keeps the catalog’s own order inside a list, so the page never re-sorts what the engine stated', () => {
		setupCommandsPage({
			commands: [
				buildCommandCatalogEntry({ id: 'plan', slash: '/plan' }),
				buildCommandCatalogEntry({ id: 'brainstorm', slash: '/brainstorm' }),
				buildCommandCatalogEntry({ id: 'implement', slash: '/implement' }),
			],
		});

		expect(readSectionTitles({ section: 'Skills' })).toStrictEqual(['/plan', '/brainstorm', '/implement']);
	});
});

describe('CommandsPage rows', () => {
	test('titles a terminal command with the full line a reader types', () => {
		setupCommandsPage({ commands: [cliOnly({ id: 'doctor' })] });

		expect(readSectionTitles({ section: 'CLI' })).toStrictEqual(['lightsout doctor']);
	});

	test('makes the whole row the link to that command’s own page, addressed by its catalog id rather than its title', () => {
		setupCommandsPage({ commands: [buildCommandCatalogEntry({ id: 'test-coverage-to-threshold', slash: '/test-coverage-to-threshold' })] });

		const link = readRowLink({ title: '/test-coverage-to-threshold' });

		expect(link).toHaveAttribute('href', '/commands/test-coverage-to-threshold');
	});

	test('prints the catalog’s one-line summary in full, so a reader can choose without opening the page', () => {
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

		const tag = within(screen.getByRole('listitem')).getByText(label);

		expect(tag).toBeInTheDocument();
	});

	test('tags nothing on a command that leaves nothing behind, rather than saying so on most rows', () => {
		setupCommandsPage({ commands: [buildCommandCatalogEntry({ records: CommandRecordKind.Nothing })] });

		const tag = within(screen.getByRole('listitem')).queryByText(/^Saves /);

		expect(tag).not.toBeInTheDocument();
	});

	test('renders inline code in a summary as code, never as raw backticks', () => {
		setupCommandsPage({ commands: [buildCommandCatalogEntry({ summary: 'Rolls onward per the `auto-plan` config block.' })] });

		const code = within(screen.getByRole('listitem')).getByText('auto-plan');

		expect({ tag: code.tagName, backticks: screen.queryByText(/`/) }).toStrictEqual({ tag: 'CODE', backticks: null });
	});
});
