import { CommandActor } from '#src/contracts/commands/CommandActor.ts';
import type { CommandStep } from '#src/contracts/commands/CommandStep.ts';

export const implementSteps: CommandStep[] = [
	{
		title: 'START THE RUN',
		actor: CommandActor.Engine,
		bullets: [
			'Hand the finished plan to `/implement`',
			'Resolve settings from the config',
			'Snapshot existing worktree changes and create a run ID',
			'Create a repository lock so other lightsout runs cannot clash',
		],
		note: 'Isolates the agent’s changes and makes the run safely resumable',
		saved: ['<run folder>/manifest.json', '.lightsout/lock.json'],
	},
	{
		title: 'VERIFY THE REPO STARTS GREEN',
		actor: CommandActor.Engine,
		bullets: [
			'Run lint, type checks, tests, build, and coverage before implementation begins',
			'Stop immediately if any gate is already failing',
			'Record files touched by setup or gates in the manifest',
		],
		note: 'Proves any later failure was introduced by this run, not inherited from the repository',
		saved: ['manifest.json', '<run folder>/commands.jsonl'],
	},
	{
		title: 'WRITE THE ACCEPTANCE TESTS',
		actor: CommandActor.Agent,
		bullets: [
			'Write the tests the plan names as its acceptance tests, before any code',
			'Later changes may correct a test the plan made stale, but never weaken or drop one',
			'Skip this step when the plan names no acceptance tests',
		],
		note: 'Fixes what done means before the code that has to meet it exists',
		saved: ['<run folder>/agents/', 'stream-NN-write-ledger-tests.jsonl'],
	},
	{
		title: 'IMPLEMENT THE PLAN',
		actor: CommandActor.Agent,
		bullets: [
			'The implementation agent follows the finished spec',
			'It writes the code and returns a structured report',
			'It can run only commands explicitly allowed in the config',
		],
		note: 'Executes the finished spec without reopening settled decisions',
		saved: ['<run folder>/agents/', 'stream-NN-implement.jsonl', 'rejected-*.txt'],
	},
	{
		title: 'VERIFY THE IMPLEMENTATION',
		actor: CommandActor.Engine,
		bullets: [
			'Run the configured formatter, then re-run lint, type checks, tests, build, and coverage',
			'Try up to two lightweight repairs if a gate fails',
			'If the gates remain red, park the run with all evidence',
		],
		note: 'Prevents a broken implementation from moving forward',
		saved: ['manifest.json', '.lightsout/friction.jsonl'],
	},
	{
		title: 'WRITE THE TESTS',
		actor: CommandActor.Agent,
		bullets: [
			'Spawn a test-writing agent for each source file that changed',
			'Add tests until coverage meets the configured threshold',
			'Skip this step when no eligible source files changed',
		],
		note: 'Makes sure the new behavior is covered by tests',
		saved: ['<run folder>/agents/', 'stream-NN-write-tests.jsonl'],
	},
	{
		title: 'VERIFY THE TESTS',
		actor: CommandActor.Engine,
		bullets: [
			'Run the configured formatter, then re-run lint, type checks, tests, build, and coverage',
			'Check that every acceptance test ran and passed',
			'Try up to two lightweight repairs if a gate fails',
		],
		note: 'Confirms the new tests pass and coverage meets the configured threshold',
		saved: ['manifest.json', '.lightsout/friction.jsonl'],
	},
	{
		title: 'REFACTOR',
		actor: CommandActor.Agent,
		bullets: [
			'Review changed code for duplication and structural issues',
			'Reuse existing helpers or extract shared abstractions',
			'Refactor to your code standards without changing behavior',
			'Skip this step when requested or when nothing changed',
		],
		note: 'Removes duplication and keeps agent-written code aligned with your code standards',
		saved: ['<run folder>/agents/', 'stream-NN-refactor.jsonl'],
	},
	{
		title: 'VERIFY THE REFACTOR',
		actor: CommandActor.Engine,
		bullets: ['Run the configured formatter, then re-run lint, type checks, tests, build, and coverage', 'Try up to two lightweight repairs if a gate fails'],
		note: 'Confirms the refactor preserved behavior and passes every gate',
		saved: ['manifest.json', '.lightsout/friction.jsonl'],
	},
	{
		title: 'COMMIT AND REPORT',
		actor: CommandActor.Engine,
		bullets: [
			'Commit each unit that passed — a phase, or the whole run — as `<ticket>: <summary>`, naming the plan and the run in the body',
			'Fail the run when its agents changed no files',
			'Record the final status, steps, retries, rejected reports, token cost, and friction in the run folder',
		],
		note: 'Leaves the verified work in git history and an inspectable record of why the run passed or failed',
		saved: ['<run folder>/'],
	},
	{
		title: 'SHIP THE BRANCH',
		actor: CommandActor.Engine,
		bullets: [
			'Only when asked: with `--ship`, or when the config sets `ship.after-implement`',
			'Bring in the latest main and re-run the gates',
			'Push, open the pull request, wait for its checks, then merge and clean up',
		],
		note: 'Takes a passed run all the way to merged without a second command',
		saved: ['.lightsout/work-orders/<name>/ship.json'],
	},
];
