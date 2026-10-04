import type { GradeDocsCoverage } from '#src/contracts/plan/memory/GradeDocsCoverage.ts';
import type { GradeMemory } from '#src/contracts/plan/memory/GradeMemory.ts';
import type { GradeReadCoverage } from '#src/contracts/plan/memory/GradeReadCoverage.ts';
import { getInvalidatedPhases } from '#src/plan/runPlanGrade/common/getStandingCoverage/getInvalidatedPhases/getInvalidatedPhases.ts';

interface Params {
	coverage: GradeMemory['coverage'];
	/** Overview included, because the documentation entry covers it. */
	designHashes: Map<string, string>;
	/** The overview is never among them: no reader reads it alone. */
	phaseFiles: string[];
	lenses: string[];
	connections?: Map<string, Set<string>>;
	otherInputChanged: boolean;
	/** Plan files the caller places as lost whatever their text says. */
	seeds?: string[];
}

const recordedNeighbours = ({ readers }: { readers: GradeReadCoverage[] }) => {
	const recorded = new Map<string, string[]>();

	for (const entry of readers) {
		recorded.set(entry.file, [...new Set([...(recorded.get(entry.file) ?? []), ...entry.neighbours])]);
	}

	return recorded;
};

/**
 * Seeds join before the closure is walked, so a seeded file's neighbours fall
 * with it. A file holding SOME lenses' entries is deliberately not lost: a lens
 * added since the last pass re-runs only itself, while a file nobody has read is
 * a phase whose hand-offs reach its neighbours.
 */
const lostOnTheirOwn = ({
	readers,
	designHashes,
	phaseFiles,
	seeds,
}: {
	readers: GradeReadCoverage[];
	designHashes: Map<string, string>;
	phaseFiles: string[];
	seeds: string[];
}) => {
	const moved = phaseFiles.filter((file) => readers.some((entry) => entry.file === file && entry.designSha256 !== designHashes.get(file)));
	const unread = phaseFiles.filter((file) => !readers.some((entry) => entry.file === file));

	return [...new Set([...seeds, ...moved, ...unread])];
};

/** Any difference in the file set drops it: the checker reads every plan file at once, and one that never saw a file may never approve it. */
const standingDocs = ({ docs, designHashes }: { docs?: GradeDocsCoverage; designHashes: Map<string, string> }) => {
	const recorded = docs?.planFiles ?? [];
	const stands = docs !== undefined && recorded.length === designHashes.size && recorded.every((entry) => designHashes.get(entry.file) === entry.designSha256);

	return stands ? docs : undefined;
};

/** A reading taken under different prompts, standards, configuration or model is no reading of this plan, so `otherInputChanged` drops every entry. */
export const getStandingCoverage = ({
	coverage,
	designHashes,
	phaseFiles,
	lenses,
	connections,
	otherInputChanged,
	seeds = [],
}: Params): {
	readers: GradeReadCoverage[];
	/** The plan files holding a standing entry for every lens. */
	covered: string[];
	invalidated: string[];
	docs?: GradeDocsCoverage;
} => {
	if (otherInputChanged) {
		return { readers: [], covered: [], invalidated: [...phaseFiles].sort() };
	}

	const edited = lostOnTheirOwn({ readers: coverage.readers, designHashes, phaseFiles, seeds });
	const lost = getInvalidatedPhases({ edited, connections, recorded: recordedNeighbours({ readers: coverage.readers }), phaseFiles });
	const readers = coverage.readers.filter((entry) => !lost.includes(entry.file) && entry.designSha256 === designHashes.get(entry.file));
	const covers = ({ file, lens }: { file: string; lens: string }) => readers.some((entry) => entry.file === file && entry.lens === lens);
	const covered = phaseFiles.filter((file) => lenses.every((lens) => covers({ file, lens }))).sort();
	const docs = standingDocs({ docs: coverage.docs, designHashes });

	return {
		readers,
		covered,
		invalidated: phaseFiles.filter((file) => !covered.includes(file)).sort(),
		...(docs === undefined ? {} : { docs }),
	};
};
