import { readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { MoveDirection } from '#src/common/constants/MoveDirection.ts';
import { mapPathThroughMoves } from '#src/common/mapPathThroughMoves.ts';
import { FindingSeverity } from '#src/contracts/plan/grade/FindingSeverity.ts';
import { StructuralCheck } from '#src/contracts/plan/grade/StructuralCheck.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';
import type { PhaseFile } from '#src/plan/common/types/PhaseFile.ts';
import { getPhaseProvenance } from '#src/plan/internal/common/utils/getPhaseProvenance.ts';
import { checkMoveOverlaps } from '#src/plan/internal/expandFolderMoves/checkMoveOverlaps.ts';
import { readGitTrackedFiles } from '#src/plan/internal/expandFolderMoves/readGitTrackedFiles.ts';

interface Params {
	cwd: string;
	/** Implementable phases only, already ordered by phase number. */
	phases: PhaseFile[];
}

interface Move {
	from: string;
	to: string;
}

const isSameMove = ({ left, right }: { left: Move; right: Move }) => left.from === right.from && left.to === right.to;

const isUnder = ({ path, folder }: { path: string; folder: string }) => path.startsWith(`${folder}/`);

const withMovePaths = ({ phase, movePaths }: { phase: PhaseFile; movePaths: Move[] }): PhaseFile => ({ ...phase, plan: { ...phase.plan, movePaths } });

/** A phase whose flagged file moves are dropped, or the phase itself when none is. */
const withoutFlagged = ({ phase, flagged }: { phase: PhaseFile; flagged: Move[] }) => {
	const kept = phase.plan.movePaths.filter((move) => !flagged.some((entry) => isSameMove({ left: entry, right: move })));

	return kept.length === phase.plan.movePaths.length ? phase : withMovePaths({ phase, movePaths: kept });
};

/**
 * `git mv` cannot move a folder onto a file, and nests it inside a folder that
 * is already there, so a file at the path itself or any file under it that git
 * does not track (untracked or ignored) means the destination exists.
 */
const holdsUntrackedFiles = async ({ cwd, folder, tracked }: { cwd: string; folder: string; tracked: Set<string> }) => {
	const root = join(cwd, folder);
	const found = await stat(root).catch(() => undefined);
	let holds = found?.isFile() === true;

	if (found?.isDirectory() === true) {
		const entries = await readdir(root, { recursive: true, withFileTypes: true });

		holds = entries.some((entry) => !entry.isDirectory() && !tracked.has(relative(cwd, join(entry.parentPath, entry.name))));
	}

	return holds;
};

const finding = ({ phase, move, issue, fix }: { phase: string; move: Move; issue: string; fix: string }) => ({
	check: StructuralCheck.MoveWellFormed,
	severity: FindingSeverity.Blocking,
	phase,
	issue: `the folder move \`${move.from}/\` → \`${move.to}/\` ${issue}`,
	location: `${phase} → ${move.from}/`,
	fix,
});

/** The first folder-level defect that applies, in the order the plan states them, or undefined for a sound move. */
const folderDefect = async ({
	cwd,
	phase,
	move,
	filesUnder,
	tracked,
}: {
	cwd: string;
	phase: string;
	move: Move;
	filesUnder: (folder: string) => string[];
	tracked: Set<string>;
}) => {
	let defect: StructuralFinding | undefined;

	if (move.to === move.from || isUnder({ path: move.to, folder: move.from })) {
		defect = finding({
			phase,
			move,
			issue: 'lands inside its own source folder',
			fix: 'choose a destination outside the source folder',
		});
	} else if (filesUnder(move.to).length > 0 || (await holdsUntrackedFiles({ cwd, folder: move.to, tracked }))) {
		defect = finding({
			phase,
			move,
			issue: 'lands on a destination that already exists, so git would nest the folder inside it rather than move it',
			fix: 'choose a destination folder that does not exist yet',
		});
	} else if (filesUnder(move.from).length === 0) {
		defect = finding({
			phase,
			move,
			issue: 'carries no files: git tracks none under its source and no earlier phase adds any there',
			fix: 'correct the source folder',
		});
	}

	return defect;
};

/**
 * One phase expanded both ways. A folder's files are the ones git tracks under
 * it minus what earlier phases removed, plus what earlier phases provided there,
 * read from `getPhaseProvenance` over the moves as written so the fold rules
 * live in one place.
 */
const expandPhase = async ({
	cwd,
	phase,
	earlier,
	trackedFiles,
	flagged,
}: {
	cwd: string;
	phase: PhaseFile;
	earlier: PhaseFile[];
	trackedFiles: string[];
	flagged: Move[];
}) => {
	const provenance = getPhaseProvenance({ phases: [...earlier, phase] });
	const provided = provenance.providedBefore.get(phase.base) ?? new Set<string>();
	const removed = provenance.removedBefore.get(phase.base) ?? new Set<string>();
	const tracked = new Set(trackedFiles);
	const filesUnder = (folder: string) =>
		[...new Set([...trackedFiles.filter((path) => !removed.has(path)), ...provided])].filter((path) => isUnder({ path, folder })).sort();
	const checkedCarried: Move[] = [];
	const provenanceCarried: Move[] = [];
	const findings: StructuralFinding[] = [];

	for (const move of phase.plan.folderMoves) {
		const carried = filesUnder(move.from).map((path) => ({
			from: path,
			to: mapPathThroughMoves({ path, fileMoves: [], folderMoves: [move], direction: MoveDirection.Forward }),
		}));
		const isFlagged = flagged.some((entry) => isSameMove({ left: entry, right: move }));
		const defect = isFlagged ? undefined : await folderDefect({ cwd, phase: phase.base, move, filesUnder, tracked });

		provenanceCarried.push(...carried);

		if (defect !== undefined) {
			findings.push(defect);
		} else if (!isFlagged) {
			checkedCarried.push(...carried);
		}
	}

	const kept = withoutFlagged({ phase, flagged });

	return {
		checked: withMovePaths({ phase: kept, movePaths: [...kept.plan.movePaths, ...checkedCarried] }),
		provenance: withMovePaths({ phase, movePaths: [...phase.plan.movePaths, ...provenanceCarried] }),
		findings,
	};
};

/**
 * Expands every folder move into the file moves it carries, folded phase by
 * phase, so every count, path and provenance check runs unchanged on file moves.
 *
 * `phases` is the checked expansion: a move the overlap check flags, or a folder
 * move with a folder-level finding, is left out, so its defect is reported once
 * at its heading and never again as per-file findings whose fixes would not
 * apply to a folder. `provenancePhases` reads every move as written, so a later
 * phase relying on what a defective move would have provided is not blamed for it.
 *
 * @throws {Error} When a phase has a folder move and git cannot list the files it
 * tracks: no plan edit fixes that, so it is no finding for the repair agent
 */
export const expandFolderMoves = async ({
	cwd,
	phases,
}: Params): Promise<{ phases: PhaseFile[]; provenancePhases: PhaseFile[]; findings: StructuralFinding[] }> => {
	const overlaps = phases.map((phase) => checkMoveOverlaps({ plan: phase.plan, phase: phase.base }));
	const folders = [...new Set(phases.flatMap((phase) => phase.plan.folderMoves.flatMap((move) => [move.from, move.to])))];

	const trackedFiles = folders.length === 0 ? [] : await readGitTrackedFiles({ cwd, folders });

	if (trackedFiles === undefined) {
		throw new Error(
			`git could not list the files it tracks in ${cwd}: folder moves are expanded from the files git tracks, so the plan check must run inside the repository's git working tree`,
		);
	}

	const checkedPhases: PhaseFile[] = [];
	const provenancePhases: PhaseFile[] = [];
	const findings: StructuralFinding[] = [];

	for (const [index, phase] of phases.entries()) {
		const { findings: overlapFindings, flagged } = overlaps[index] ?? { findings: [], flagged: [] };
		const expanded =
			phase.plan.folderMoves.length === 0
				? { checked: withoutFlagged({ phase, flagged }), provenance: phase, findings: [] }
				: await expandPhase({ cwd, phase, earlier: provenancePhases, trackedFiles, flagged });

		checkedPhases.push(expanded.checked);
		provenancePhases.push(expanded.provenance);
		findings.push(...overlapFindings, ...expanded.findings);
	}

	return { phases: checkedPhases, provenancePhases, findings };
};
