import { commandCatalog } from '#src/commands/commandCatalog/commandCatalog.ts';
import { spellFlag } from '#src/commands/spellFlag.ts';
import type { CommandCatalogEntry } from '#src/contracts/commands/CommandCatalogEntry.ts';
import type { CommandFlag } from '#src/contracts/commands/CommandFlag.ts';
import type { CommandInvocation } from '#src/contracts/commands/CommandInvocation.ts';

/** Not catalog order: the catalog is grouped for the commands page, and the usage text keeps its own order. */
const usageOrder = [
	'implement',
	'implement-folder',
	'implement-direct',
	'resume',
	'stop',
	'ship',
	'queue',
	'status',
	'status-run',
	'status-now',
	'status-planning',
	'status-shipping',
	'status-queue',
	'report',
	'doctor',
	'standards-check',
	'standards-check-list',
	'standards-validate',
	'standards-health',
	'refactor',
	'refactor-resume',
	'test-coverage-to-threshold',
	'test-coverage-to-threshold-resume',
	'brainstorm-publish',
	'plan-workspace',
	'plan-verify-facts',
	'plan-draft',
	'plan-sync-decisions',
	'plan-sync-phases',
	'plan-lint',
	'plan-dedup',
	'plan-grade',
	'plan-publish',
	'work-order-new',
	'work-order-add-plan',
	'work-order-mode',
	'work-order-request-ship',
	'work-order-exclude-plan',
	'work-order-retitle-plan',
	'work-order-show',
	'work-order-sync',
	'ticket-state',
	'self-check',
	'friction',
	'improve',
	'voice-toggle',
	'voice-hook',
];

const renderExclusiveGroup = ({ flags, key }: { flags: CommandFlag[]; key: string }) => {
	const group = flags.filter((flag) => flag.exclusiveWith === key);

	return `[${group.map((flag) => spellFlag({ flag })).join(' | ')}]`;
};

/** Flags sharing an `exclusiveWith` key collapse into one bracket at the position of the first of them. */
const renderFlags = ({ entry, invocation }: { entry: CommandCatalogEntry; invocation: CommandInvocation }) => {
	const shown = entry.flags.filter((flag) => flag.shape === undefined || flag.shape === invocation.id);
	const rendered: string[] = [];
	const groupsSeen = new Set<string>();

	for (const flag of shown) {
		if (flag.exclusiveWith === undefined) {
			rendered.push(flag.required ? spellFlag({ flag }) : `[${spellFlag({ flag })}]`);
		} else if (!groupsSeen.has(flag.exclusiveWith)) {
			groupsSeen.add(flag.exclusiveWith);
			rendered.push(renderExclusiveGroup({ flags: shown, key: flag.exclusiveWith }));
		}
	}

	return rendered;
};

/** Aligned to column 55, one-based, with a three-space minimum for a line that already reaches it. */
const padNote = ({ body, note }: { body: string; note: string }) => `${body}${' '.repeat(Math.max(3, 54 - body.length))}(${note})`;

const renderLine = ({ cli, entry, invocation }: { cli: string; entry: CommandCatalogEntry; invocation: CommandInvocation }) => {
	const words = [cli, invocation.positional, ...renderFlags({ entry, invocation })].filter((word) => word !== undefined);
	const body = `  ${words.join(' ')}`;

	return invocation.note === undefined ? body : padNote({ body, note: invocation.note });
};

/**
 * One line per id in `usageOrder`, so a skill-only entry like `auto-plan` is
 * never emitted and needs no exclusion rule of its own.
 */
export const renderUsage = (): string => {
	const header = 'lightsout — deterministic engine for coding agents\n\nusage:';
	const exitCodes = `exit codes (implement, resume, refactor, test-coverage-to-threshold):
  0  finished
  2  stopped with work left and resumable — a --max-batches ceiling, or a harness rate limit
  1  anything else`;
	const lines: string[] = [];

	for (const id of usageOrder) {
		const entry = commandCatalog.find((candidate) => candidate.invocations.some((invocation) => invocation.id === id));
		const invocation = entry?.invocations.find((candidate) => candidate.id === id);

		if (entry?.cli !== undefined && invocation !== undefined) {
			lines.push(renderLine({ cli: entry.cli, entry, invocation }));
		}
	}

	return `${header}\n${lines.join('\n')}\n\n${exitCodes}\n`;
};
