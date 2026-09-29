import { totalActivityNode } from '#src/activity/internal/common/utils/totalActivityNode.ts';
import type { ActivityLevelKind } from '#src/contracts/activity/ActivityLevelKind.ts';
import type { ActivityMark } from '#src/contracts/activity/ActivityMark.ts';
import { ActivityMarkKind } from '#src/contracts/activity/ActivityMarkKind.ts';
import type { ActivityNode } from '#src/contracts/activity/ActivityNode.ts';
import type { HarnessProcessMark } from '#src/contracts/activity/HarnessProcessMark.ts';
import type { RunStatus } from '#src/contracts/run/RunStatus.ts';

interface Params {
	marks: ActivityMark[];
}

interface LevelWindow {
	id: string;
	level: ActivityLevelKind;
	label: string;
	parentId?: string;
	startedAt: string;
	endedAt?: string;
	outcome?: RunStatus;
	/** How many start marks carried this id, and how many end marks answered them. */
	starts: number;
	ends: number;
}

type Children = Map<string, LevelWindow[]>;
type Processes = Map<string, HarnessProcessMark[]>;

const isEarlier = ({ left, right }: { left: string; right: string }) => Date.parse(left) < Date.parse(right);

/**
 * Several processes open a plan-kind level with the same id, one per command
 * run, so repeated starts fold into one window. The level is finished only when
 * every start was answered by an end.
 */
const foldLevels = ({ marks }: Params) => {
	const levels = new Map<string, LevelWindow>();

	for (const mark of marks) {
		if (mark.kind !== ActivityMarkKind.LevelStart) {
			continue;
		}

		const open = levels.get(mark.id);

		if (open === undefined) {
			levels.set(mark.id, {
				id: mark.id,
				level: mark.level,
				label: mark.label,
				parentId: mark.parentId,
				startedAt: mark.at,
				starts: 1,
				ends: 0,
			});
		} else {
			open.starts += 1;
			open.startedAt = isEarlier({ left: mark.at, right: open.startedAt }) ? mark.at : open.startedAt;
		}
	}

	for (const mark of marks) {
		if (mark.kind !== ActivityMarkKind.LevelEnd) {
			continue;
		}

		const open = levels.get(mark.id);

		if (open === undefined) {
			continue;
		}

		open.ends += 1;

		if (open.endedAt === undefined || !isEarlier({ left: mark.at, right: open.endedAt })) {
			open.endedAt = mark.at;
			open.outcome = mark.outcome;
		}
	}

	for (const open of levels.values()) {
		if (open.ends < open.starts) {
			open.endedAt = undefined;
			open.outcome = undefined;
		}
	}

	return levels;
};

/** A level naming a parent no start mark carries becomes a root, so its recorded time is never lost. */
const groupChildren = ({ levels }: { levels: Map<string, LevelWindow> }) => {
	const children: Children = new Map();
	const roots: LevelWindow[] = [];

	for (const open of levels.values()) {
		const parent = open.parentId === undefined ? undefined : levels.get(open.parentId);

		if (parent === undefined) {
			roots.push(open);
		} else {
			children.set(parent.id, [...(children.get(parent.id) ?? []), open]);
		}
	}

	return { children, roots };
};

/** A process naming a level nothing started is dropped: inventing a window would put time where nothing happened. */
const groupProcesses = ({ marks, levels }: { marks: ActivityMark[]; levels: Map<string, LevelWindow> }) => {
	const grouped: Processes = new Map();

	for (const mark of marks) {
		if (mark.kind === ActivityMarkKind.HarnessProcess && levels.has(mark.levelId)) {
			grouped.set(mark.levelId, [...(grouped.get(mark.levelId) ?? []), mark]);
		}
	}

	return grouped;
};

interface TreeParams {
	level: LevelWindow;
	children: Children;
	processes: Processes;
}

const gatherProcesses = ({ level, children, processes }: TreeParams): HarnessProcessMark[] => [
	...(processes.get(level.id) ?? []),
	...(children.get(level.id) ?? []).flatMap((child) => gatherProcesses({ level: child, children, processes })),
];

const buildNode = ({ level, children, processes }: TreeParams): ActivityNode => ({
	id: level.id,
	level: level.level,
	label: level.label,
	startedAt: level.startedAt,
	endedAt: level.endedAt,
	outcome: level.outcome,
	processes: processes.get(level.id) ?? [],
	totals: totalActivityNode({ startedAt: level.startedAt, endedAt: level.endedAt, processes: gatherProcesses({ level, children, processes }) }),
	children: (children.get(level.id) ?? []).map((child) => buildNode({ level: child, children, processes })),
});

export const nestActivityMarks = ({ marks }: Params): ActivityNode[] => {
	const levels = foldLevels({ marks });
	const processes = groupProcesses({ marks, levels });
	const { children, roots } = groupChildren({ levels });

	return roots.map((level) => buildNode({ level, children, processes }));
};
