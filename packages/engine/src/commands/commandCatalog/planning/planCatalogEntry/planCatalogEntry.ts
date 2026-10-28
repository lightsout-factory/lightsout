import { planSteps } from '#src/commands/commandCatalog/planning/planCatalogEntry/planSteps.ts';
import type { CommandCatalogEntry } from '#src/contracts/commands/CommandCatalogEntry.ts';
import { CommandGroup } from '#src/contracts/commands/CommandGroup.ts';
import { CommandRecordKind } from '#src/contracts/commands/CommandRecordKind.ts';

export const planCatalogEntry: CommandCatalogEntry = {
	id: 'plan',
	slash: '/lightsout:plan',
	cli: 'lightsout plan',
	group: CommandGroup.Build,
	summary:
		'Turn a feature idea into a plan detailed enough for an agent to build without guessing. It interviews you, stress-tests the plan, and grades it to an A.',
	whenToUse:
		'Use it when you know what you want and need a plan a fresh agent could implement without guessing. It interviews you, drafts, grills the draft for edge cases, and grades the result before anyone writes code. Decisions a brainstorm already settled are not asked again; one the planner believes is weak is flagged to you once, and stands until you change it. `publish` attaches the plan files and whichever of brainstorm-notes.md, decisions.json, grade.json and grade-memory.json exist, then a plan-attachments.json marker; transcripts stay local, and publishing again replaces the same-titled files.',
	invocations: [
		{ id: 'plan-workspace', positional: 'workspace' },
		{ id: 'plan-verify-facts', positional: 'verify-facts' },
		{ id: 'plan-draft', positional: 'draft' },
		{ id: 'plan-sync-decisions', positional: 'sync-decisions' },
		{ id: 'plan-sync-phases', positional: 'sync-phases' },
		{ id: 'plan-lint', positional: 'lint' },
		{ id: 'plan-dedup', positional: 'dedup' },
		{ id: 'plan-grade', positional: 'grade', note: '--phase grades only those phases, and always marks the result incomplete' },
		{ id: 'plan-publish', positional: 'publish' },
	],
	flags: [
		{
			name: 'name',
			value: '<name>',
			meaning: 'The plan to work in, under .lightsout/work-orders/<work-order-name>/plans/ — a plan address <work-order-name>/<NNN-slug>.',
			required: true,
		},
		{
			name: 'notes',
			value: '<path>',
			meaning: 'Rough notes to start from — a /brainstorm file, or anything you wrote yourself.',
			fallback: 'The workspace starts from the request alone.',
			shape: 'plan-verify-facts',
			required: false,
		},
		{
			name: 'scope',
			value: 'single|phased',
			meaning: 'Whether to write one plan or an overview with a file per phase.',
			fallback: 'Chosen from the size of the work.',
			shape: 'plan-draft',
			required: false,
		},
		{
			name: 'phase',
			value: '<n[,n]>',
			meaning: 'Grade only these phases of a phased plan.',
			fallback: 'Every phase is graded, and the result may be complete.',
			shape: 'plan-grade',
			required: false,
		},
		{
			name: 'cwd',
			value: '<path>',
			meaning: 'The checkout the command is launched from; the plan’s worktree is resolved from it.',
			fallback: 'The process working directory.',
			required: false,
		},
		{
			name: 'worktree',
			meaning: 'Plan in a fresh git worktree of this repository, on a branch named after the plan’s ticket folder.',
			fallback: 'The `plan.worktree` config key, which defaults to on.',
			required: false,
		},
		{ name: 'no-worktree', meaning: 'Plan in the checkout this was launched from rather than a worktree of its own.', required: false },
	],
	steps: planSteps,
	records: CommandRecordKind.Plans,
	related: ['auto-plan', 'brainstorm', 'implement', 'resume', 'stop', 'ship', 'implement-direct', 'queue', 'work-order', 'ticket-state', 'self-check'],
	graphic: {
		title: 'How /plan turns a request into an implementation-ready spec',
		subtitle: 'Final spec and every decision recorded before any code is written.',
		banner: 'The implementation-ready spec can now be handed to /implement in a fresh context window.',
		columns: 4,
	},
};
