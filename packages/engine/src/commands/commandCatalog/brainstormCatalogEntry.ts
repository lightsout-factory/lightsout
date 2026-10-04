import type { CommandCatalogEntry } from '#src/contracts/commands/CommandCatalogEntry.ts';
import { CommandGroup } from '#src/contracts/commands/CommandGroup.ts';
import { CommandRecordKind } from '#src/contracts/commands/CommandRecordKind.ts';

export const brainstormCatalogEntry: CommandCatalogEntry = {
	id: 'brainstorm',
	slash: '/brainstorm',
	cli: 'lightsout brainstorm',
	group: CommandGroup.Build,
	summary:
		'Shape a vague idea into a buildable direction through dialogue — checks whether it is one idea or several, offers the competing approaches worth building, with trade-offs and a recommendation, and converges on a design stated in plain words.',
	whenToUse:
		'Reach for it when the idea is still a sentence and you are not sure it is one idea or three. It decides its own outcome — ready to implement, or ready to auto-plan — and publishes the design write-up and the settled decisions to the ticket.',
	invocations: [{ id: 'brainstorm-publish', positional: 'publish' }],
	flags: [
		{
			name: 'name',
			value: '<name>',
			meaning: 'The brainstorm’s plan, under .lightsout/work-orders/<work-order-name>/plans/ — a plan address <work-order-name>/<NNN-slug>.',
			required: true,
		},
		{ name: 'cwd', value: '<path>', meaning: 'Repository the brainstorm workspace lives in.', fallback: 'The process working directory.', required: false },
	],
	steps: [],
	records: CommandRecordKind.Plans,
	related: ['auto-plan', 'plan', 'implement', 'resume', 'stop', 'ship', 'implement-direct', 'queue', 'work-order', 'ticket-state', 'self-check'],
};
