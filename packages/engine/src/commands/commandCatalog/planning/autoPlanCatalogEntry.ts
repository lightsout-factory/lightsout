import type { CommandCatalogEntry } from '#src/contracts/commands/CommandCatalogEntry.ts';
import { CommandGroup } from '#src/contracts/commands/CommandGroup.ts';
import { CommandRecordKind } from '#src/contracts/commands/CommandRecordKind.ts';

/** `/auto-plan` — a skill with no CLI command behind it: it drives the `plan` subcommands, and what it changes is who answers the questions. */
export const autoPlanCatalogEntry: CommandCatalogEntry = {
	id: 'auto-plan',
	slash: '/auto-plan',
	group: CommandGroup.Build,
	summary:
		'Run the whole /plan process without you — the agent answers every question /plan would put to you, including the grill and stress-test questions, by taking its own recommendation; only a question that clears the escalation bar reaches you. It then shows you one proposal and rolls onward per the `auto-plan` config block.',
	whenToUse:
		'Reach for it when the ticket is shaped enough that you would answer most of the interview with "you decide". It stops for the questions two reasonable engineers would answer differently, and for nothing else; the `auto-plan` config block says whether approval also starts the build.',
	invocations: [],
	flags: [],
	steps: [],
	records: CommandRecordKind.Plans,
	related: ['brainstorm', 'plan', 'implement', 'resume', 'stop', 'ship', 'implement-direct', 'queue', 'work-order', 'ticket-state', 'self-check'],
};
