import { formatCost, formatDuration, formatTokenCount } from '@lightsout/shared';
import { estimateActivityCost } from '#src/activity/estimateActivityCost.ts';
import { harnessProcessLabel } from '#src/cli/internal/common/activityReport/harnessProcessLabel.ts';
import { renderTable } from '#src/cli/internal/common/render/renderTable.ts';
import { bold } from '#src/cli/internal/common/terminal/bold.ts';
import { dim } from '#src/cli/internal/common/terminal/dim.ts';
import { ActivityLevelKind } from '#src/contracts/activity/ActivityLevelKind.ts';
import type { ActivityNode } from '#src/contracts/activity/ActivityNode.ts';
import type { ActivityReport } from '#src/contracts/activity/ActivityReport.ts';
import type { HarnessProcessMark } from '#src/contracts/activity/HarnessProcessMark.ts';
import type { HarnessProcessUsage } from '#src/contracts/activity/HarnessProcessUsage.ts';
import type { ConfigPricing } from '#src/contracts/ConfigPricing.ts';

interface Params {
	report: ActivityReport;
	pricing?: ConfigPricing;
}

type Row = Parameters<typeof renderTable>[0]['rows'][number];

/** Matches `formatDuration`'s own placeholder. */
const notReported = '—';

/**
 * Wall time and agent time are never added together: agents run in parallel,
 * so a level's agent time routinely exceeds its wall time, and `peak` explains
 * the gap.
 *
 * Cache reads and writes share one column for width; `--json` carries them
 * separately.
 */
const baseHeaders = ['level', 'wall', 'agent', 'peak', 'share', 'in', 'out', 'cache', 'cost'];

const indentOf = ({ depth }: { depth: number }) => '  '.repeat(depth);

const tokenCell = ({ count }: { count?: number }) => (count === undefined ? notReported : formatTokenCount({ count }));

const costCell = ({ usd }: { usd?: number }) => (usd === undefined ? notReported : formatCost({ usd }));

const cacheTokens = ({ usage }: { usage: HarnessProcessUsage }) => {
	const reported = [usage.cacheReadTokens, usage.cacheCreationTokens].flatMap((count) => (count === undefined ? [] : [count]));

	return reported.length === 0 ? undefined : reported.reduce((total, count) => total + count, 0);
};

const usageCells = ({ usage }: { usage?: HarnessProcessUsage }) => [
	tokenCell({ count: usage?.inputTokens }),
	tokenCell({ count: usage?.outputTokens }),
	tokenCell({ count: usage === undefined ? undefined : cacheTokens({ usage }) }),
	costCell({ usd: usage?.costUsd }),
];

const estimateCells = ({ node, pricing }: { node: ActivityNode; pricing?: ConfigPricing }) =>
	pricing === undefined ? [] : [costCell({ usd: estimateActivityCost({ node, pricing }) })];

const shareCell = ({ ms, ofMs }: { ms: number; ofMs?: number }) => (ofMs === undefined || ofMs === 0 ? notReported : `${((ms / ofMs) * 100).toFixed(1)}%`);

/** Local time, and no seconds because the duration column carries them. */
const clockOf = ({ at }: { at: string }) => {
	const when = new Date(at);

	return `${when.getHours()}:${String(when.getMinutes()).padStart(2, '0')}`;
};

/**
 * A plan row's engine time: its command runs' wall times added up. A plan is
 * several commands a person starts by hand, so the time between them belongs to
 * nobody and is left out.
 */
const engineMs = ({ node }: { node: ActivityNode }) => {
	const runs = node.children
		.filter((child) => child.level === ActivityLevelKind.CommandRun)
		.flatMap((child) => (child.totals.wallMs === undefined ? [] : [child.totals.wallMs]));

	return runs.length === 0 ? node.totals.agentMs : runs.reduce((total, ms) => total + ms, 0);
};

const agentMsOf = ({ node }: { node: ActivityNode }) => (node.level === ActivityLevelKind.Plan ? engineMs({ node }) : node.totals.agentMs);

interface AccountingParams {
	label: string;
	ms: number;
	depth: number;
	headers: string[];
}

const accountingRow = ({ label, ms, depth, headers }: AccountingParams): Row => ({
	cells: [`${indentOf({ depth })}${label}`, formatDuration({ ms }), ...headers.slice(2).map(() => notReported)],
	paintCell: ({ padded }: { padded: string }) => dim(padded),
	ruleAbove: false,
});

interface ProcessParams {
	/** The level the process ran inside — handed on so the estimator prices this one process through the shape it takes. */
	node: ActivityNode;
	process: HarnessProcessMark;
	depth: number;
	parentAgentMs?: number;
	pricing?: ConfigPricing;
}

/** One process cannot overlap itself, so its duration is both its wall and agent time, and its peak is one. */
const processRow = ({ node, process, depth, parentAgentMs, pricing }: ProcessParams): Row => {
	const durationMs = Date.parse(process.endedAt) - Date.parse(process.startedAt);
	const named = [
		harnessProcessLabel({ process }),
		`#${process.spawn}`,
		...(process.reemit ? ['re-emit'] : []),
		`${clockOf({ at: process.startedAt })}–${clockOf({ at: process.endedAt })}`,
		process.endReason,
	];

	return {
		cells: [
			`${indentOf({ depth })}${named.join(' · ')}`,
			formatDuration({ ms: durationMs }),
			formatDuration({ ms: durationMs }),
			'1',
			shareCell({ ms: durationMs, ofMs: parentAgentMs }),
			...usageCells({ usage: process.usage }),
			// The estimator prices a node, so one process is handed to it as this level holding nothing else.
			...estimateCells({ node: { ...node, processes: [process], children: [] }, pricing }),
		],
		ruleAbove: false,
	};
};

interface RowParams {
	node: ActivityNode;
	depth: number;
	/** The parent's own agent time, which this level's share divides. Absent on a root, which has no parent to be a share of. */
	parentAgentMs?: number;
	pricing?: ConfigPricing;
	headers: string[];
}

const levelRow = ({ node, depth, parentAgentMs, pricing }: Omit<RowParams, 'headers'>): Row => ({
	cells: [
		`${indentOf({ depth })}${node.label}${node.endedAt === undefined ? ' · unfinished' : ''}`,
		formatDuration({ ms: node.totals.wallMs }),
		formatDuration({ ms: agentMsOf({ node }) }),
		`${node.totals.peakProcesses}`,
		shareCell({ ms: node.totals.agentMs, ofMs: parentAgentMs }),
		...usageCells({ usage: node.totals.usage }),
		...estimateCells({ node, pricing }),
	],
	emphasis: depth === 0 ? bold : undefined,
	// A rule between every tree row would hide the nesting.
	ruleAbove: depth === 0,
});

const rowsFor = ({ node, depth, parentAgentMs, pricing, headers }: RowParams): Row[] => {
	const rows = [levelRow({ node, depth, parentAgentMs, pricing })];
	const waitingMs = (node.totals.wallMs ?? 0) - engineMs({ node });

	for (const child of node.children) {
		rows.push(...rowsFor({ node: child, depth: depth + 1, parentAgentMs: node.totals.agentMs, pricing, headers }));
	}

	for (const process of node.processes) {
		rows.push(processRow({ node, process, depth: depth + 1, parentAgentMs: node.totals.agentMs, pricing }));
	}

	// Not the idle row below: idle time also counts the engine's own work inside a
	// command run, where this is only the time between command runs.
	if (node.level === ActivityLevelKind.Plan && waitingMs > 0) {
		rows.push(accountingRow({ label: 'waiting between command runs', ms: waitingMs, depth: depth + 1, headers }));
	}

	if (node.totals.idleMs !== undefined && node.totals.idleMs > 0) {
		rows.push(accountingRow({ label: 'idle — no agent running', ms: node.totals.idleMs, depth: depth + 1, headers }));
	}

	return rows;
};

/**
 * The estimated-cost column is labelled as an estimate, because a computed
 * figure unlabelled beside ones a harness stated would read as one of them.
 */
export const renderActivityTree = ({ report, pricing }: Params): string[] => {
	const note = "estimated — this repository's configured rates applied to the recorded tokens; nothing computed from them is stored";
	// Only ever appended, so every other column sits where it sat without a price list.
	const headers = pricing === undefined ? baseHeaders : [...baseHeaders, 'estimated'];
	const rows = report.roots.flatMap((node) => rowsFor({ node, depth: 0, pricing, headers }));
	const table = renderTable({ headers, rows });

	return pricing === undefined ? table : [...table, dim(`  ${note}`)];
};
