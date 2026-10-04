import { MoveDirection } from '#src/common/constants/MoveDirection.ts';
import { findCoveringMove } from '#src/common/findCoveringMove.ts';
import { mapPathThroughMoves } from '#src/common/mapPathThroughMoves.ts';
import { isGeneratedPath } from '#src/common/sourceFiles/isGeneratedPath.ts';
import { countTokens } from '#src/pipeline/common/countTokens.ts';
import { describeTokenSurplus } from '#src/pipeline/common/describeTokenSurplus.ts';
import type { PipelineRun } from '#src/pipeline/common/PipelineRun.ts';
import { pairCheckpointChanges } from '#src/pipeline/common/pairCheckpointChanges.ts';
import { readCheckpointChanges } from '#src/pipeline/common/readCheckpointChanges.ts';
import { readComparisonSides } from '#src/pipeline/common/readComparisonSides.ts';
import type { CheckpointComparison } from '#src/pipeline/common/types/CheckpointComparison.ts';
import { countPathTokens } from '#src/pipeline/moveCheck/checkMoveOnlyChanges/countPathTokens.ts';
import { readGitHeadBlobIds } from '#src/pipeline/moveCheck/checkMoveOnlyChanges/readGitHeadBlobIds.ts';
import { readGitWorkingBlobIds } from '#src/pipeline/moveCheck/checkMoveOnlyChanges/readGitWorkingBlobIds.ts';

interface Params {
	run: PipelineRun;
	/** The verification checkpoint in flight — it labels the progress lines. */
	checkpoint: string;
	/** The plan's declared file moves. */
	fileMoves: { from: string; to: string }[];
	/** The plan's declared folder moves, with no trailing `/`. */
	folderMoves: { from: string; to: string }[];
}

type Moves = Pick<Params, 'fileMoves' | 'folderMoves'>;

interface ContentBound {
	allowedTokens: Set<string>;
	standalonePaths: Set<string>;
}

// A file untracked at the phase start rides along with its folder, and a
// generated file moves on whichever side its own path is generated; neither is
// the agent's edit, so both sides of such a pair are left out.
const leaveOutCarriedAlong = ({ run, moves, removed, added }: { run: PipelineRun; moves: Moves; removed: string[]; added: string[] }) => {
	const baselineDirty = new Set(run.current().baselineDirtyFiles);
	const generated = run.config.generated ?? [];
	const mapped = ({ path, direction }: { path: string; direction: MoveDirection }) => mapPathThroughMoves({ path, ...moves, direction });

	return {
		removed: removed.filter((path) => !isGeneratedPath({ path: mapped({ path, direction: MoveDirection.Forward }), generated })),
		added: added.filter((path) => {
			const source = mapped({ path, direction: MoveDirection.Back });

			return !baselineDirty.has(source) && !isGeneratedPath({ path: source, generated });
		}),
	};
};

const coveringMoveLabel = ({ path, moves }: { path: string; moves: Moves }) => {
	const move = findCoveringMove({ path, ...moves, direction: MoveDirection.Forward });
	const slash = move?.isFolder === true ? '/' : '';

	return move === undefined ? undefined : `${move.source}${slash} → ${move.target}${slash}`;
};

// A declared move is carried out in full only when nothing it covers is left at its old path.
const refuseLeftBehind = ({ run, moves, headBlobIds, removed }: { run: PipelineRun; moves: Moves; headBlobIds: Map<string, string>; removed: string[] }) => {
	const baselineDirty = new Set(run.current().baselineDirtyFiles);
	const generated = run.config.generated ?? [];
	const removedPaths = new Set(removed);

	return [...headBlobIds.keys()].flatMap((path) => {
		const move = coveringMoveLabel({ path, moves });
		const leftBehind = move !== undefined && !removedPaths.has(path) && !baselineDirty.has(path) && !isGeneratedPath({ path, generated });

		return leftBehind ? [`- ${path}: left at its old path by the declared move ${move}`] : [];
	});
};

const buildContentBound = ({ moves }: { moves: Moves }): ContentBound => {
	const paths = [...moves.fileMoves, ...moves.folderMoves].flatMap(({ from, to }) => [from, to]);
	const allowedTokens = new Set(['/', '.', '-', ...paths.flatMap((path) => [...countTokens({ text: path }).keys()])]);
	const standalonePaths = new Set(paths.flatMap((path) => [path, path.split('/').at(-1) ?? path]));

	return { allowedTokens, standalonePaths };
};

const withoutAllowed = ({ counts, allowedTokens }: { counts: Map<string, number>; allowedTokens: Set<string> }) =>
	new Map([...counts].filter(([token]) => !allowedTokens.has(token)));

const compareContent = async ({ run, comparison, bound }: { run: PipelineRun; comparison: CheckpointComparison; bound: ContentBound }) => {
	const { start, current, label } = await readComparisonSides({ run, comparison });
	let refusal: string | undefined;

	// Every invalid UTF-8 sequence decodes to U+FFFD, so two different binaries
	// can read as the same text; only a side free of it was decoded losslessly.
	if (start.includes('�') || current.includes('�')) {
		refusal = `- ${label}: its content is not UTF-8 text, and a file that is not text may only be moved unchanged`;
	} else {
		const before = countPathTokens({ text: start, standalonePaths: bound.standalonePaths });
		const after = countPathTokens({ text: current, standalonePaths: bound.standalonePaths });
		const insideBefore = withoutAllowed({ counts: before.inside, allowedTokens: bound.allowedTokens });
		const insideAfter = withoutAllowed({ counts: after.inside, allowedTokens: bound.allowedTokens });
		const describeSurpluses = ({ more, less }: { more: Map<string, number>[]; less: Map<string, number>[] }) =>
			more
				.map((counts, index) => describeTokenSurplus({ more: counts, less: less[index] ?? new Map() }))
				.filter(Boolean)
				.join(', ');
		const addedTokens = describeSurpluses({ more: [after.outside, insideAfter], less: [before.outside, insideBefore] });
		const removedTokens = describeSurpluses({ more: [before.outside, insideBefore], less: [after.outside, insideAfter] });

		if (addedTokens !== '' || removedTokens !== '') {
			refusal = `- ${label}: added ${addedTokens || 'nothing'}; removed ${removedTokens || 'nothing'}`;
		}
	}

	return refusal;
};

const unreadable = ({ checkpoint, what }: { checkpoint: string; what: string }) => ({
	error: `${checkpoint}: the move check could not read ${what} from git, so nothing is proven; no gate ran.`,
});

/**
 * `HEAD` is the phase's starting state because a phase run commits only when it
 * passes, which also holds on a resume. A pair whose blob ids match passes
 * unread, so a byte-identical binary is never tokenized. Every other changed
 * file must match `HEAD` exactly outside its path runs, and inside them may
 * differ only by `/`, `.`, `-` and the declared move paths' own tokens: a path
 * that points at a moved file may be updated, and nothing else may change.
 *
 * It fails closed: when git cannot report the working changes or the blob ids, nothing is proven.
 */
export const checkMoveOnlyChanges = async ({ run, checkpoint, fileMoves, folderMoves }: Params): Promise<{ error?: string }> => {
	const moves = { fileMoves, folderMoves };
	const changes = await readCheckpointChanges({ run });

	if (changes === undefined) {
		return unreadable({ checkpoint, what: 'the working changes' });
	}

	const headBlobIds = await readGitHeadBlobIds({ cwd: run.cwd });

	if (headBlobIds === undefined) {
		return unreadable({ checkpoint, what: "the phase's starting commit" });
	}

	const { removed, added } = leaveOutCarriedAlong({ run, moves, removed: changes.removed, added: changes.added });

	run.progress(
		`${checkpoint}: move check — comparing ${removed.length + added.length + changes.modified.length} changed file(s) against the phase's starting commit`,
	);

	const { comparisons, refusals } = pairCheckpointChanges({
		removed,
		added,
		modified: changes.modified,
		destinationOf: ({ path }) => mapPathThroughMoves({ path, ...moves, direction: MoveDirection.Forward }),
		wording: { uncovered: 'no declared move covers its path', destination: 'moved path', unclaimed: 'no removed file moves to it' },
	});

	refusals.push(...refuseLeftBehind({ run, moves, headBlobIds, removed: changes.removed }));

	const workingBlobIds = await readGitWorkingBlobIds({ cwd: run.cwd, paths: comparisons.map(({ currentPath }) => currentPath) });

	if (workingBlobIds === undefined) {
		return unreadable({ checkpoint, what: 'the changed files' });
	}

	const bound = buildContentBound({ moves });
	const changed = comparisons.filter(({ startPath, currentPath }) => headBlobIds.get(startPath) !== workingBlobIds.get(currentPath));

	for (const comparison of changed) {
		const refusal = await compareContent({ run, comparison, bound });

		if (refusal !== undefined) {
			refusals.push(refusal);
		}
	}

	if (refusals.length === 0) {
		run.progress(`${checkpoint}: move check — every changed file holds only the declared moves`);
	}

	return refusals.length === 0 ? {} : { error: [`${checkpoint}: the move check refused this checkpoint's changes; no gate ran.`, ...refusals].join('\n') };
};
