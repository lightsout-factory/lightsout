import type { ActivityTotals } from '#src/contracts/activity/ActivityTotals.ts';
import type { HarnessProcessMark } from '#src/contracts/activity/HarnessProcessMark.ts';
import type { HarnessProcessUsage } from '#src/contracts/activity/HarnessProcessUsage.ts';

interface Params {
	startedAt: string;
	/** Absent while the level is unfinished; the totals then carry no wall or idle time. */
	endedAt?: string;
	/** Every harness process recorded at or below the node, not just the ones on it. */
	processes: HarnessProcessMark[];
}

interface Window {
	start: number;
	end: number;
}

const usageFields = ['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheCreationTokens', 'costUsd'] as const;

/** Absent stays absent: a zero would be indistinguishable from a harness that reported nothing spent. */
const sumUsage = ({ processes }: { processes: HarnessProcessMark[] }) => {
	const total: HarnessProcessUsage = {};

	for (const field of usageFields) {
		const reported = processes.flatMap((process) => {
			const value = process.usage?.[field];

			return value === undefined ? [] : [value];
		});

		if (reported.length > 0) {
			total[field] = reported.reduce((running, value) => running + value, 0);
		}
	}

	return total;
};

/** The union of the windows, so a stretch two agents shared is counted once. */
const unionMs = ({ windows }: { windows: Window[] }) => {
	const ordered = [...windows].sort((left, right) => left.start - right.start);
	let covered = 0;
	let reach = Number.NEGATIVE_INFINITY;

	for (const window of ordered) {
		covered += Math.max(0, window.end - Math.max(window.start, reach));
		reach = Math.max(reach, window.end);
	}

	return covered;
};

/** A window ending exactly where the next begins is a handover, not an overlap, so ends sort before starts. */
const peakOverlap = ({ windows }: { windows: Window[] }) => {
	const moments = [...windows.map((window) => ({ at: window.end, delta: -1 })), ...windows.map((window) => ({ at: window.start, delta: 1 }))].sort(
		(left, right) => left.at - right.at || left.delta - right.delta,
	);
	let open = 0;
	let peak = 0;

	for (const moment of moments) {
		open += moment.delta;
		peak = Math.max(peak, open);
	}

	return peak;
};

/**
 * Takes raw descendant processes rather than children's totals: the union of
 * windows and the peak overlap cannot be rebuilt from totals already summed.
 */
export const totalActivityNode = ({ startedAt, endedAt, processes }: Params): ActivityTotals => {
	const windows = processes.map((process) => ({ start: Date.parse(process.startedAt), end: Date.parse(process.endedAt) }));
	const busyMs = unionMs({ windows });
	const wallMs = endedAt === undefined ? undefined : Math.max(0, Date.parse(endedAt) - Date.parse(startedAt));

	return {
		wallMs,
		agentMs: windows.reduce((running, window) => running + Math.max(0, window.end - window.start), 0),
		busyMs,
		idleMs: wallMs === undefined ? undefined : Math.max(0, wallMs - busyMs),
		peakProcesses: peakOverlap({ windows }),
		processCount: processes.length,
		usage: sumUsage({ processes }),
	};
};
