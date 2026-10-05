import type { CommandCatalogEntry } from '#src/contracts/commands/CommandCatalogEntry.ts';
import { CommandGroup } from '#src/contracts/commands/CommandGroup.ts';
import { CommandRecordKind } from '#src/contracts/commands/CommandRecordKind.ts';

export const shipCatalogEntry: CommandCatalogEntry = {
	id: 'ship',
	cli: 'lightsout ship',
	group: CommandGroup.Build,
	summary: 'Take the current branch from committed work to merged and cleaned up, and write a typed result.',
	whenToUse:
		'Run it when the branch is committed and you want it merged: it pushes the branch, opens or adopts the pull request, waits for the checks, merges, deletes the branch and syncs the default branch — then writes one JSON result a tracker skill can read. Pass --hand-built only when the person asks to ship work they built by hand.',
	invocations: [{ id: 'ship' }],
	flags: [
		{
			name: 'hand-built',
			meaning:
				"Record the person's authorization to ship work built outside the engine on a single-plan work order holding no plan 001, saved on the record with who and when.",
			fallback: 'Such a work order ships only once its build from the ticket body passed.',
			required: false,
		},
		{ name: 'cwd', value: '<path>', meaning: 'Repository to ship from.', fallback: 'The process working directory.', required: false },
	],
	steps: [],
	records: CommandRecordKind.Nothing,
	related: ['auto-plan', 'brainstorm', 'plan', 'implement', 'resume', 'stop', 'implement-direct', 'queue', 'work-order', 'ticket-state', 'self-check'],
};
