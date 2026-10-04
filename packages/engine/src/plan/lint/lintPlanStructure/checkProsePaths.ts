import { basename, join } from 'node:path';
import { pathExists } from '#src/common/pathExists.ts';
import { FindingSeverity } from '#src/contracts/plan/grade/FindingSeverity.ts';
import { StructuralCheck } from '#src/contracts/plan/grade/StructuralCheck.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';
import { getCodeSpans } from '#src/plan/common/getCodeSpans.ts';
import { getPlanNamedPaths } from '#src/plan/common/getPlanNamedPaths.ts';
import { isPathToken } from '#src/plan/common/paths/isPathToken.ts';
import type { ParsedPlan } from '#src/plan/common/types/ParsedPlan.ts';
import { isLineInRange } from '#src/plan/lint/lintPlanStructure/common/isLineInRange.ts';
import type { RepoPathIndex } from '#src/plan/lint/lintPlanStructure/common/types/RepoPathIndex.ts';

interface Params {
	plan: ParsedPlan;
	cwd: string;
	/** Absolute. */
	planPath: string;
	/** The finding label: this file's basename. */
	phase: string;
	/** Every path any file in this deliverable creates or moves to, deliverable-wide rather than phase-ordered. */
	planned: Set<string>;
	index: RepoPathIndex;
}

/** Segment-aligned: `views/getRunView.ts` is `src/contracts/views/getRunView.ts` and is never `src/myviews/getRunView.ts`. */
const isTailOf = ({ candidate, path }: { candidate: string; path: string }) => path === candidate || path.endsWith(`/${candidate}`);

/**
 * Refused: whitespace (a command), `://` or a leading `/` (never a repo-relative
 * entry), and `*`, `${` or `<` (a family of files, such as
 * `.lightsout/runs/<id>/worklist.json`). Leading alias, relative and elision
 * segments are stripped so the tail match can resolve the rest; an elision in the
 * middle leaves nothing a tail can recover, so it is refused rather than guessed
 * at. A leading `.lightsout` is kept, since only segments made entirely of dots go.
 */
const normalizeCandidate = ({ token }: { token: string }) => {
	if (/\s/.test(token) || token.includes('*') || token.includes('${') || token.includes('<') || token.includes('://') || token.startsWith('/')) {
		return undefined;
	}

	const segments = token.split('/');

	while (segments.length > 0 && (/^[.…]+$/.test(segments[0]) || segments[0].startsWith('#') || segments[0].startsWith('@'))) {
		segments.shift();
	}

	const candidate = segments.join('/');

	return candidate.includes('/') && !candidate.includes('...') && !candidate.includes('…') ? candidate : undefined;
};

/**
 * The `## Decision Log` is passed over: a recorded decision may name a rejected
 * option's path or a file that has since moved, and it is no claim about the working tree.
 */
const collectCandidates = ({ plan }: { plan: ParsedPlan }) => {
	const candidates = new Map<string, number>();

	for (const [index, line] of plan.lines.entries()) {
		if (isLineInRange({ line: index + 1, range: plan.decisionLogRange })) {
			continue;
		}

		for (const token of getCodeSpans({ line })) {
			const candidate = isPathToken({ token }) ? normalizeCandidate({ token }) : undefined;

			if (candidate !== undefined && !candidates.has(candidate)) {
				candidates.set(candidate, index + 1);
			}
		}
	}

	return candidates;
};

/**
 * These belong to `checkPlanPaths`, so one wrong path never produces two
 * findings. `planned` is deliverable-wide rather than phase-ordered, because this
 * check asks whether a name is real at all; phase-ordered, every path an
 * `overview.md` declares would be reported missing at draft time.
 */
const getAccountedPaths = ({ plan, planned }: { plan: ParsedPlan; planned: Set<string> }) => [
	...new Set([...getPlanNamedPaths({ plan, includeMirrors: true }), ...planned]),
];

/**
 * A candidate anchored at a top-level directory is `stat`ed, so a repo-rooted
 * path the walk pruned is still found. A miss falls through to the tail match,
 * because top-level names such as `scripts` or `docs` also occur nested.
 */
const isCandidateOnDisk = async ({ candidate, cwd, index }: { candidate: string; cwd: string; index: RepoPathIndex }) => {
	const anchored = index.topLevelDirs.has(candidate.split('/')[0]) && (await pathExists({ path: join(cwd, candidate) }));

	return anchored || index.files.some((path) => isTailOf({ candidate, path }));
};

/**
 * The plan template states the convention this relies on: backticks around a
 * path assert the file exists. Blocking, because only blocking findings reach the
 * repair loop's correcting agent, so every span it cannot decide is skipped
 * rather than guessed at.
 */
export const checkProsePaths = async ({ plan, cwd, planPath, phase, planned, index }: Params): Promise<StructuralFinding[]> => {
	// An empty pool means the walk failed or `cwd` is not the repo root, never
	// that nothing exists; judging against it would block on every path.
	if (index.files.length === 0) {
		return [];
	}

	const accounted = getAccountedPaths({ plan, planned });
	const findings: StructuralFinding[] = [];

	for (const [candidate, line] of collectCandidates({ plan })) {
		if (accounted.some((path) => isTailOf({ candidate, path }))) {
			continue;
		}

		if (!(await isCandidateOnDisk({ candidate, cwd, index }))) {
			findings.push({
				check: StructuralCheck.ProsePathExists,
				severity: FindingSeverity.Blocking,
				phase,
				issue: `path named in prose does not exist: ${candidate}`,
				location: `${basename(planPath)}:${line}`,
				fix: 'correct the path, or drop the backticks if the span is not naming a real file',
			});
		}
	}

	return findings;
};
