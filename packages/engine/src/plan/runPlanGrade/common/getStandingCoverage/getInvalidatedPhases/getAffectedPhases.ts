interface Params {
	connections: Map<string, Set<string>>;
	edited: string[];
}

/**
 * Transitive rather than adjacent-only: a contract phase 1 changes may be
 * re-exported by phase 2 and consumed by phase 3.
 *
 * An edited basename the graph does not know still comes back, so a phase whose
 * edges could not be read is read rather than skipped.
 */
export const getAffectedPhases = ({ connections, edited }: Params): string[] => {
	const affected = new Set<string>(edited);
	const pending = [...edited];

	while (pending.length > 0) {
		const base = pending.shift() ?? '';

		for (const neighbour of connections.get(base) ?? []) {
			if (!affected.has(neighbour)) {
				affected.add(neighbour);
				pending.push(neighbour);
			}
		}
	}

	return [...affected].sort();
};
