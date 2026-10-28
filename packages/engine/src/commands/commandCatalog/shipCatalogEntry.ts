import type { CommandCatalogEntry } from '#src/contracts/commands/CommandCatalogEntry.ts';
import { CommandGroup } from '#src/contracts/commands/CommandGroup.ts';
import { CommandRecordKind } from '#src/contracts/commands/CommandRecordKind.ts';

export const shipCatalogEntry: CommandCatalogEntry = {
	id: 'ship',
	cli: 'lightsout ship',
	group: CommandGroup.Build,
	summary: 'Take a finished branch to merged — bring in the latest main, re-run the checks, open the pull request, wait for CI, then merge and clean up.',
	whenToUse:
		'Run it when the branch is committed and you want it merged: it pushes the branch, opens or adopts the pull request, waits for the checks, merges, deletes the branch and syncs the default branch — then writes one JSON result a tracker skill can read. Nothing is committed or pushed until the default branch is merged in and your gates pass; a conflict or a red gate gets a bounded agent recovery, and when that runs out the branch is put back where ship found it. A merge refused because the default branch moved, or a failed check on the pushed commit, earns another attempt, up to three. Pass --hand-built only when the person asks to ship work they built by hand.',
	invocations: [{ id: 'ship' }],
	flags: [
		{
			name: 'hand-built',
			meaning:
				'Record the person’s authorization to ship work built outside the engine on a single-plan work order holding no plan 001, saved on the record with who (git’s user.name and user.email) and when. Adding plan 001, starting a build from the ticket body, or switching to multiple-plan mode withdraws it.',
			fallback: 'Such a work order ships only once its build from the ticket body passed.',
			required: false,
		},
		{ name: 'cwd', value: '<path>', meaning: 'Repository to ship from.', fallback: 'The process working directory.', required: false },
	],
	steps: [],
	records: CommandRecordKind.Nothing,
	related: ['auto-plan', 'brainstorm', 'plan', 'implement', 'resume', 'stop', 'implement-direct', 'queue', 'work-order', 'ticket-state', 'self-check'],
};
