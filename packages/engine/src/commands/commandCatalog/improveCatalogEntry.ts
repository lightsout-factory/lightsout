import type { CommandCatalogEntry } from '#src/contracts/commands/CommandCatalogEntry.ts';
import { CommandGroup } from '#src/contracts/commands/CommandGroup.ts';
import { CommandRecordKind } from '#src/contracts/commands/CommandRecordKind.ts';

export const improveCatalogEntry: CommandCatalogEntry = {
	id: 'improve',
	cli: 'lightsout improve',
	group: CommandGroup.Housekeeping,
	summary: 'Turn this repo’s friction into a proposed change to lightsout itself.',
	whenToUse:
		'Use it when this repo’s friction is really the engine’s problem. It turns those findings into a change proposal against a lightsout checkout you point it at.',
	invocations: [{ id: 'improve' }],
	flags: [
		{ name: 'engine', value: '<lightsout-repo-path>', meaning: 'The lightsout checkout the change proposal is written against.', required: true },
		{ name: 'cwd', value: '<path>', meaning: 'Repository whose friction is read.', fallback: 'The process working directory.', required: false },
	],
	steps: [],
	records: CommandRecordKind.Nothing,
	related: ['status', 'doctor', 'friction', 'voice', 'report'],
};
