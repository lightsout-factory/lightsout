import type { RawStandardsFinding, StandardsCheckModule } from '@lightsout/standards-contracts';
import { buildRawFinding } from '#common/findings/buildRawFinding.ts';
import { isTestFile } from '#common/paths/isTestFile.ts';

/** What each source file imports, files and imports both in path order, so the same repo always yields the same findings. */
const mapImportsBySource = ({
	edges,
	standardsLibraries,
}: {
	edges: Array<{ from: string; to: string }>;
	standardsLibraries: string[];
}): Map<string, string[]> => {
	const targetsBySource = new Map<string, Set<string>>();
	const isSource = (path: string) => !isTestFile({ path, standardsLibraries });

	for (const { from, to } of edges) {
		if (isSource(from) && isSource(to)) {
			targetsBySource.set(from, (targetsBySource.get(from) ?? new Set<string>()).add(to));
		}
	}

	return new Map([...targetsBySource.keys()].sort().map((from) => [from, [...(targetsBySource.get(from) ?? [])].sort()]));
};

/**
 * Tarjan's strongly connected components: each group is a set of files that
 * all reach each other through imports. It walks with its own stack rather
 * than recursion, since an import chain can run deeper than the call stack.
 */
const findCycleGroups = ({ importsBySource }: { importsBySource: Map<string, string[]> }): string[][] => {
	const orders = new Map<string, number>();
	const grouped = new Set<string>();
	const open: string[] = [];
	const groups: string[][] = [];
	const visit = ({ path }: { path: string }) => {
		orders.set(path, orders.size);
		open.push(path);

		return { path, lowest: orders.size - 1, next: 0 };
	};

	for (const root of importsBySource.keys()) {
		const walk = orders.has(root) ? [] : [visit({ path: root })];

		for (let current = walk.at(-1); current !== undefined; current = walk.at(-1)) {
			const target = importsBySource.get(current.path)?.[current.next];
			const targetOrder = target === undefined ? undefined : orders.get(target);

			current.next += 1;

			if (target === undefined) {
				const parent = walk.at(-2);

				walk.pop();

				if (parent !== undefined) {
					parent.lowest = Math.min(parent.lowest, current.lowest);
				}

				if (current.lowest === orders.get(current.path)) {
					const group = open.splice(open.lastIndexOf(current.path));

					for (const path of group) {
						grouped.add(path);
					}

					groups.push(group);
				}
			} else if (targetOrder === undefined) {
				walk.push(visit({ path: target }));
			} else if (!grouped.has(target)) {
				current.lowest = Math.min(current.lowest, targetOrder);
			}
		}
	}

	return groups.filter((group) => group.length > 1);
};

/** Breadth first, so the first way back to `start` is a shortest one. The files come back in import order, `start` first. */
const findCycleThrough = ({ start, members, importsBySource }: { start: string; members: Set<string>; importsBySource: Map<string, string[]> }): string[] => {
	const importers = new Map<string, string>();
	const queue = [start];

	for (const path of queue) {
		for (const target of importsBySource.get(path) ?? []) {
			if (target === start) {
				const cycle: string[] = [];

				for (let step: string | undefined = path; step !== undefined; step = importers.get(step)) {
					cycle.unshift(step);
				}

				return cycle;
			}

			if (members.has(target) && !importers.has(target)) {
				importers.set(target, path);
				queue.push(target);
			}
		}
	}

	return [];
};

const findShortestCycle = ({ group, importsBySource }: { group: string[]; importsBySource: Map<string, string[]> }): string[] => {
	const members = new Set(group);

	return [...group]
		.sort()
		.map((start) => findCycleThrough({ start, members, importsBySource }))
		.reduce((shortest, cycle) => (cycle.length < shortest.length ? cycle : shortest));
};

export const check: StandardsCheckModule = {
	inputKind: 'import-graph',
	/**
	 * Files that all reach each other through imports are one group, and a group
	 * is one finding: its shortest cycle, every file named in import order.
	 * Breaking that cycle is one fix, and a group can hold more cycles than
	 * anyone would read; the next shortest is reported once this one is gone.
	 *
	 * An `import type` counts, since the shared type is the piece the rule says
	 * to move. A test file is never part of a cycle: the rule is about source
	 * code, and a build does not load a test.
	 *
	 * Cycles are found across the whole repo and reported when one of their files
	 * is in scope, so a finding has the same identity in a full run and a narrow one.
	 */
	run: ({ input }): RawStandardsFinding[] => {
		if (input.kind !== 'import-graph') {
			return [];
		}

		const { files, edges, standardsLibraries } = input;
		const scope = new Set(files);
		const importsBySource = mapImportsBySource({ edges, standardsLibraries });

		return findCycleGroups({ importsBySource })
			.map((group) => ({ group, cycle: findShortestCycle({ group, importsBySource }) }))
			.filter(({ cycle }) => cycle.some((path) => scope.has(path)))
			.map(({ group, cycle }) => {
				const [first, ...rest] = cycle.map((path) => `'${path}'`);
				const chain = [...rest, first].map((path) => `imports ${path}`).join(', which ');
				const size = group.length > cycle.length ? ` — the shortest cycle among ${group.length} files that import each other` : '';

				return buildRawFinding({
					rule: 'circular-dependencies',
					files: cycle.map((path) => ({ path })),
					detail: `${first} ${chain}${size}`,
					guidance: 'Move the piece these files share, usually a type, into a file each of them imports, so that the imports run one way.',
				});
			});
	},
};
