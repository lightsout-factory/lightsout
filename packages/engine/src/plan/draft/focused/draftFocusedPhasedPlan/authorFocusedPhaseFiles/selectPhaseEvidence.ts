import type { PhaseDeclaration } from '#src/common/types/PhaseDeclaration.ts';
import type { SourceEvidenceIndex } from '#src/contracts/plan/evidence/SourceEvidenceIndex.ts';
import type { ExploreArea } from '#src/contracts/plan/facts/ExploreArea.ts';
import type { PlanFacts } from '#src/contracts/plan/facts/PlanFacts.ts';

interface Params {
	evidence: SourceEvidenceIndex;
	facts: PlanFacts;
	declaration: PhaseDeclaration;
}

const atPath = ({ at }: { at: string }) => at.replace(/:\d+(?::\d+)?$/, '');

/**
 * Cut one folder below the source root rather than at the containing directory,
 * because a phase creating `.../draft/focused/authorFocusedPhaseFiles.ts` is
 * plainly working on the same surface as `.../draft/repairPlanStructure.ts`,
 * and an exact-directory comparison would call them unrelated.
 */
const neighbourhood = ({ path }: { path: string }) => {
	const segments = path.split('/').slice(0, -1);
	const sourceRoot = segments.indexOf('src');

	return (sourceRoot === -1 ? segments : segments.slice(0, sourceRoot + 2)).join('/');
};

const areaPaths = ({ area }: { area: ExploreArea }) => [
	...area.filesToModify.map(({ path }) => path),
	...area.patternsToMirror.map(({ path }) => path),
	...area.integrationPoints.map(({ at }) => atPath({ at })),
];

/**
 * Every `patternsToMirror` path is contributed whatever the phase: a reference
 * pattern is what the writer is asked to imitate, rather than something its own
 * paths point at. A declaration that creates nothing has nothing to narrow by
 * and receives the whole index.
 */
export const selectPhaseEvidence = ({ evidence, facts, declaration }: Params): SourceEvidenceIndex => {
	if (declaration.creates.length === 0) {
		return evidence;
	}

	const created = new Set(declaration.creates.map((path) => neighbourhood({ path })));
	const wanted = new Set<string>();

	for (const area of facts.areas) {
		const paths = areaPaths({ area });

		for (const path of paths.some((path) => created.has(neighbourhood({ path }))) ? paths : area.patternsToMirror.map(({ path }) => path)) {
			wanted.add(path);
		}
	}

	return { ...evidence, entries: evidence.entries.filter((entry) => wanted.has(entry.path)) };
};
