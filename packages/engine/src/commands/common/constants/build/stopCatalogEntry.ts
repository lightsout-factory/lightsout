import type { CommandCatalogEntry } from '#src/contracts/commands/CommandCatalogEntry.ts';
import { CommandGroup } from '#src/contracts/commands/CommandGroup.ts';
import { CommandRecordKind } from '#src/contracts/commands/CommandRecordKind.ts';

/** `lightsout stop` — no skill ships for it, because the skills only point the user at it. */
export const stopCatalogEntry: CommandCatalogEntry = {
	id: 'stop',
	cli: 'lightsout stop',
	group: CommandGroup.Build,
	summary: 'Stop the engine process behind a run, from any terminal or session, and leave the run resumable.',
	whenToUse:
		'Use it on a detached run, or any run whose launching terminal you cannot reach. Any run id of its family works, the short id a report printed included. The engine is asked to shut down first, which stops its own agents and gates; if it is still running after ten seconds it is killed outright, its agents may remain, and you must make sure no agent is still working in the run’s worktree before you resume it. A queue worker’s run lives inside the queue’s process, so it is stopped by stopping its queue. Stopping a run that has nothing running behind it is not an error. After a clean stop, resume the run with the command the stop prints. It needs macOS or Linux, and refuses on Windows.',
	invocations: [{ id: 'stop' }],
	flags: [
		{ name: 'run', value: '<id>', meaning: 'The run to stop: any run of its family, short id included.', required: true },
		{ name: 'cwd', value: '<path>', meaning: 'Repository the run belongs to.', fallback: 'The process working directory.', required: false },
	],
	steps: [],
	records: CommandRecordKind.Nothing,
	related: ['auto-plan', 'brainstorm', 'plan', 'implement', 'implement-direct', 'resume', 'ship', 'queue', 'work-order', 'ticket-state', 'self-check'],
};
