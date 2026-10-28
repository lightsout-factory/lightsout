import type { CommandCatalogEntry } from '#src/contracts/commands/CommandCatalogEntry.ts';
import { CommandGroup } from '#src/contracts/commands/CommandGroup.ts';
import { CommandRecordKind } from '#src/contracts/commands/CommandRecordKind.ts';

export const testCoverageToThresholdCatalogEntry: CommandCatalogEntry = {
	id: 'test-coverage-to-threshold',
	slash: '/lightsout:test-coverage-to-threshold',
	cli: 'lightsout test-coverage-to-threshold',
	group: CommandGroup.BurnDown,
	summary: 'Write tests until the repo’s own coverage check passes, in small batches, each verified before the next. Stop and resume any time.',
	whenToUse:
		'Use it when the coverage gate is what stands between you and a green build. It writes tests in batches until your own coverage script passes, and stops there.',
	invocations: [{ id: 'test-coverage-to-threshold' }, { id: 'test-coverage-to-threshold-resume', note: 'resume a parked coverage run' }],
	flags: [
		{
			name: 'run',
			value: '<id>',
			meaning: 'The parked coverage run to pick back up, on the configuration it recorded when it started; a run that recorded none is refused.',
			shape: 'test-coverage-to-threshold-resume',
			required: true,
		},
		{ name: 'cwd', value: '<path>', meaning: 'Repository to raise coverage in.', fallback: 'The process working directory.', required: false },
		{
			name: 'max-batches',
			value: '<n>',
			meaning: 'Park the run after this many batches.',
			fallback: 'The run continues until the coverage script passes.',
			shape: 'test-coverage-to-threshold',
			required: false,
		},
		{ name: 'allow-dirty', meaning: 'Start even though the git tree has uncommitted changes.', shape: 'test-coverage-to-threshold', required: false },
	],
	steps: [],
	records: CommandRecordKind.Runs,
	related: ['refactor', 'standards-check'],
};
