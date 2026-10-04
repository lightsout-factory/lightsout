import type { GapCheckLens } from '#src/contracts/plan/grade/GapCheckLens.ts';
import type { GradeDocsCoverage } from '#src/contracts/plan/memory/GradeDocsCoverage.ts';
import type { GradeMemory } from '#src/contracts/plan/memory/GradeMemory.ts';
import type { GradeReadCoverage } from '#src/contracts/plan/memory/GradeReadCoverage.ts';

interface Params {
	standing: GradeReadCoverage[];
	docs?: GradeDocsCoverage;
	/** Per pair, not per file: a lens that returned keeps its entry even when a sibling lens failed on the same file. */
	read: Array<{ phase: string; lens: GapCheckLens }>;
	/** A light file is read by nobody, so a full set of entries is written for it at its current design hash. */
	light: { phases: string[]; lenses: string[] };
	designHashes: Map<string, string>;
	/** Absent when it could not be built, and then no reader entry is written. */
	connections?: Map<string, Set<string>>;
	documentationChecked: boolean;
	/** True when a human narrowed this pass with `--phase`: nothing is recorded. */
	narrowed: boolean;
	at: string;
}

const keyOf = ({ file, lens }: { file: string; lens: string }) => `${file}\u0000${lens}`;

/**
 * A light file gets a full set of entries though no reader read it, so
 * `getStandingCoverage` needs no light-file rule of its own.
 */
const pairsRead = ({ read, light }: { read: Params['read']; light: Params['light'] }) => {
	const pairs = new Map<string, { file: string; lens: string }>();

	for (const { phase, lens } of read) {
		pairs.set(keyOf({ file: phase, lens }), { file: phase, lens });
	}

	for (const file of light.phases) {
		for (const lens of light.lenses) {
			pairs.set(keyOf({ file, lens }), { file, lens });
		}
	}

	return [...pairs.values()];
};

/**
 * With no graph no entry is written: an entry recording no neighbours could
 * never be invalidated along a graph, so it would claim a reading nothing can
 * take back.
 */
const freshEntries = ({ read, light, designHashes, connections, at }: Pick<Params, 'read' | 'light' | 'designHashes' | 'connections' | 'at'>) => {
	if (connections === undefined) {
		return [];
	}

	return pairsRead({ read, light }).flatMap(({ file, lens }) => {
		const designSha256 = designHashes.get(file);

		return designSha256 === undefined ? [] : [{ file, lens, designSha256, neighbours: [...(connections.get(file) ?? [])].sort(), at }];
	});
};

/** Sorted so the next pass's comparison reads one settled order. */
const documentationEntry = ({ designHashes, at }: Pick<Params, 'designHashes' | 'at'>) => ({
	planFiles: [...designHashes].map(([file, designSha256]) => ({ file, designSha256 })).sort((left, right) => left.file.localeCompare(right.file)),
	at,
});

/**
 * Writes no file, so every change to `grade-memory.json` still goes through
 * `writeGradeMemory` and its contract parse.
 *
 * A narrowed pass records nothing: a human's `--phase` must never buy an
 * approval.
 */
export const recordReadCoverage = ({
	standing,
	docs,
	read,
	light,
	designHashes,
	connections,
	documentationChecked,
	narrowed,
	at,
}: Params): GradeMemory['coverage'] => {
	if (narrowed) {
		return { readers: standing, docs };
	}

	const fresh = freshEntries({ read, light, designHashes, connections, at });
	const written = new Set(fresh.map((entry) => keyOf(entry)));

	return {
		readers: [...standing.filter((entry) => !written.has(keyOf(entry))), ...fresh],
		docs: documentationChecked ? documentationEntry({ designHashes, at }) : docs,
	};
};
