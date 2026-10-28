import { refactorSteps } from '#src/commands/commandCatalog/refactorCatalogEntry/refactorSteps.ts';
import type { CommandCatalogEntry } from '#src/contracts/commands/CommandCatalogEntry.ts';
import { CommandGroup } from '#src/contracts/commands/CommandGroup.ts';
import { CommandRecordKind } from '#src/contracts/commands/CommandRecordKind.ts';

/** `/refactor` — a fresh burn-down or the resumption of a parked one, which is why `--run` belongs to only the second shape. */
export const refactorCatalogEntry: CommandCatalogEntry = {
	id: 'refactor',
	slash: '/lightsout:refactor',
	cli: 'lightsout refactor',
	group: CommandGroup.BurnDown,
	summary:
		'Fix the problems the standards check already finds — duplicate code, oversized files, misplaced code — in small batches, each re-checked before the next. Stop and resume any time.',
	whenToUse:
		'Reach for it when standards-check has more findings than anyone will fix by hand. It burns them down in verified, resumable batches, each one gated before it lands. The run’s records sit in `.lightsout/refactor/runs/<id>/` in the primary checkout.',
	invocations: [{ id: 'refactor' }, { id: 'refactor-resume', note: 'resume a parked refactor run' }],
	flags: [
		{
			name: 'run',
			value: '<id>',
			meaning: 'The parked refactor run to pick back up, on the configuration it recorded when it started; a run that recorded none is refused.',
			shape: 'refactor-resume',
			required: true,
		},
		{ name: 'cwd', value: '<path>', meaning: 'Repository to burn down.', fallback: 'The process working directory.', required: false },
		{ name: 'path', value: '<subdir>', meaning: 'Burn down only this subdirectory.', fallback: 'The whole repository.', shape: 'refactor', required: false },
		{ name: 'all', meaning: 'Include findings the baseline has already accepted as known debt.', shape: 'refactor', required: false },
		{
			name: 'max-batches',
			value: '<n>',
			meaning: 'Park the run after this many batches.',
			fallback: 'The run continues until the work-list is finished.',
			shape: 'refactor',
			required: false,
		},
		{
			name: 'deterministic-checks',
			meaning: 'Build the work-list from the deterministic checks alone, with no agent review.',
			shape: 'refactor',
			required: false,
		},
		{
			name: 'allow-dirty',
			meaning:
				'Start even though the git tree has uncommitted changes. They are recorded as the run’s baseline and never attributed to a batch, so runs can stack before you commit.',
			fallback: 'The run refuses to start on a tree with uncommitted changes, so the ending diff is entirely its own.',
			shape: 'refactor',
			required: false,
		},
	],
	steps: refactorSteps,
	records: CommandRecordKind.Runs,
	related: ['test-coverage-to-threshold', 'standards-check'],
	graphic: {
		title: 'How /refactor turns standards findings into verified cleanup',
		subtitle: 'Twelve steps, one batch at a time, every fix re-checked and re-gated before the next begins.',
		banner: 'The engine never commits. It hands back a measured before-and-after and a diff you review.',
		columns: 4,
	},
};
