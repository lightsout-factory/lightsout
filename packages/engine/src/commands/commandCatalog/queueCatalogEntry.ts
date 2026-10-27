import type { CommandCatalogEntry } from '#src/contracts/commands/CommandCatalogEntry.ts';
import { CommandGroup } from '#src/contracts/commands/CommandGroup.ts';
import { CommandRecordKind } from '#src/contracts/commands/CommandRecordKind.ts';

export const queueCatalogEntry: CommandCatalogEntry = {
	id: 'queue',
	slash: '/lightsout:queue',
	cli: 'lightsout queue',
	group: CommandGroup.Build,
	summary:
		'Build every ticket marked ready for automation, several at once, each on its own branch and pull request. Any question an agent can’t answer comes back to you.',
	whenToUse:
		'Run it when the tracker holds tickets you have labelled for automation and you want them built without picking them up one at a time: it makes a worktree and branch per ticket, runs the worker its label names, puts any question it cannot answer to this terminal — or, with `--file-relay`, to a mailbox directory an agent session or an editor can answer from — then ships the ready branches one at a time, each with the latest default branch merged in and the gates re-run. A ticket blocked by an unfinished ticket is left behind with the blocker named. A mailbox question nobody answers parks its ticket once `queue.question-timeout` elapses. It stops when nothing is left to do; running it again resumes whatever parked. It exits 0 when everything eligible shipped, 2 when parked or left-behind work remains for a re-run, and 1 when it refused to start.',
	invocations: [{ id: 'queue' }],
	flags: [
		{
			name: 'file-relay',
			value: '[dir]',
			meaning:
				'Relay questions as files in a mailbox directory instead of asking on this terminal. Defaults to .lightsout/queue/relay under the repo, emptied at startup. `--detach` implies it.',
			fallback: 'Questions are asked on the terminal that started the drain.',
			required: false,
		},
		{ name: 'cwd', value: '<path>', meaning: 'Repository to drain into.', fallback: 'The process working directory.', required: false },
		{
			name: 'detach',
			meaning:
				'Drain in a background engine process that outlives this terminal or session. Implies `--file-relay`, on the default mailbox unless a directory is given. The command returns once the queue run has started and prints its run id, the engine pid and the mailbox; the engine’s output goes to the run’s launch log in the launches folder of the shared state dir (.lightsout/launches/<id>.log in the primary checkout). It needs macOS or Linux.',
			fallback: 'The drain runs in the foreground, asking questions on this terminal unless `--file-relay` is given.',
			required: false,
		},
	],
	steps: [],
	records: CommandRecordKind.Runs,
	related: ['auto-plan', 'brainstorm', 'plan', 'implement', 'implement-direct', 'resume', 'stop', 'ship', 'work-order', 'ticket-state', 'self-check'],
};
