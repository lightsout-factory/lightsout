import { basename } from 'node:path';
import type { PhaseDeclaration } from '#src/common/types/PhaseDeclaration.ts';
import { getPlanNamedPaths } from '#src/plan/common/getPlanNamedPaths.ts';
import { getComparableTokens } from '#src/plan/common/naming/getComparableTokens.ts';
import type { PhaseFile } from '#src/plan/common/types/PhaseFile.ts';

interface Params {
	phases: PhaseFile[];
	declarations: PhaseDeclaration[];
}

const providedBy = ({ phase, exports }: { phase: PhaseFile; exports: string[] }) =>
	new Set<string>([
		...getPlanNamedPaths({ plan: phase.plan }).map((path) => basename(path)),
		...exports,
		...getComparableTokens({ lines: phase.plan.sections.get('What Next Plan Expects') ?? [] }).keys(),
	]);

/** Whether `phase` names a path under one of `other`'s folder moves, source or destination, aligned on the slash. */
const namesPathUnderFolderMove = ({ phase, other }: { phase: PhaseFile; other: PhaseFile }) => {
	const folders = other.plan.folderMoves.flatMap((move) => [move.from, move.to]);

	return getPlanNamedPaths({ plan: phase.plan }).some((path) => folders.some((folder) => path.startsWith(`${folder}/`)));
};

/**
 * A phase supplies EVERY path it names under a file heading, not only the ones
 * it creates: two edits to one file are coupled whichever phase owns it.
 *
 * A phase naming a path under another phase's folder move is coupled to it too,
 * though they share no basename: a file a folder move carries is named nowhere
 * in the moving phase.
 *
 * Undirected because a changed shared contract affects the producer and the
 * consumer alike.
 *
 * A phase the overview does not declare is an `error`: narrowing a re-grade
 * against a graph known to be short would silently leave a phase unchecked.
 */
export const getPhaseConnections = ({ phases, declarations }: Params): { connections: Map<string, Set<string>> } | { error: string } => {
	const paired = phases.map((phase) => ({ phase, declaration: declarations.find((entry) => entry.file === phase.base) }));
	const undeclared = paired.filter((entry) => entry.declaration === undefined);

	if (undeclared.length > 0) {
		return {
			error: `${undeclared.map(({ phase }) => phase.base).join(', ')} has no block in the overview's '## Phase Declarations', so what it hands to the other phases cannot be read`,
		};
	}

	const provides = new Map<string, Set<string>>();
	const consumes = new Map<string, Set<string>>();

	for (const { phase, declaration } of paired) {
		provides.set(phase.base, providedBy({ phase, exports: declaration?.exports ?? [] }));
		consumes.set(phase.base, new Set(getComparableTokens({ lines: phase.plan.lines }).keys()));
	}

	const connections = new Map<string, Set<string>>(phases.map((phase) => [phase.base, new Set<string>()]));

	for (const left of phases) {
		for (const right of phases) {
			const linked =
				left.base !== right.base &&
				([...(consumes.get(left.base) ?? [])].some((token) => provides.get(right.base)?.has(token)) || namesPathUnderFolderMove({ phase: left, other: right }));

			if (linked) {
				connections.get(left.base)?.add(right.base);
				connections.get(right.base)?.add(left.base);
			}
		}
	}

	return { connections };
};
