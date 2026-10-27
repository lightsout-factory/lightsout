import type { CommandCatalogEntry } from '#src/contracts/commands/CommandCatalogEntry.ts';
import { CommandGroup } from '#src/contracts/commands/CommandGroup.ts';
import { CommandRecordKind } from '#src/contracts/commands/CommandRecordKind.ts';

export const doctorCatalogEntry: CommandCatalogEntry = {
	id: 'doctor',
	cli: 'lightsout doctor',
	group: CommandGroup.Housekeeping,
	summary: 'Check the install end to end — config, harness, gates, standards — and name what is missing.',
	whenToUse:
		'Run it first, on a repo where something is not working. It runs every check — config, harness, gates and standards — and prints one line for each, with the exact change that clears any warning or failure. It never edits anything.',
	invocations: [{ id: 'doctor' }],
	flags: [
		{ name: 'cwd', value: '<path>', meaning: 'Repository to check the install of.', fallback: 'The process working directory.', required: false },
		{
			name: 'usage-probe',
			meaning:
				'Spend one throwaway agent call on the configured harness to confirm its token fields still parse. Real money on your own subscription. Codex is never probed: its driver reads no usage.',
			required: false,
		},
	],
	steps: [],
	records: CommandRecordKind.Nothing,
	related: ['status', 'friction', 'improve', 'voice', 'report'],
};
