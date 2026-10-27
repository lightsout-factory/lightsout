import type { CommandCatalogEntry } from '#src/contracts/commands/CommandCatalogEntry.ts';
import { CommandGroup } from '#src/contracts/commands/CommandGroup.ts';
import { CommandRecordKind } from '#src/contracts/commands/CommandRecordKind.ts';

export const standardsValidateCatalogEntry: CommandCatalogEntry = {
	id: 'standards-validate',
	cli: 'lightsout standards-validate',
	group: CommandGroup.Standards,
	summary: 'Test each rule in a standards library against its own good and bad examples, so a rule that stops catching what it should fails loudly.',
	whenToUse:
		'Run it after writing or editing a rule or a pack file, and in CI for a library you ship. It proves each check still passes its own pass fixtures and still fails its fail fixtures, and that every pack file resolves: its include entries exist, its rule-settings name rules in the pack, and no packs include each other in a cycle.',
	invocations: [{ id: 'standards-validate', note: 'run every check against its own fixtures' }],
	flags: [
		{ name: 'library', value: '<path>', meaning: 'Validate the library at this folder.', fallback: 'The built-in lightsout library.', required: false },
		{
			name: 'cwd',
			value: '<path>',
			meaning: 'Repository whose standards-libraries the validated library’s packs resolve against.',
			fallback: 'The process working directory.',
			required: false,
		},
	],
	steps: [],
	records: CommandRecordKind.Nothing,
	related: ['standards-check', 'standards-health'],
};
