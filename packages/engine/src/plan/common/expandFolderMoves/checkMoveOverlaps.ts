import { FindingSeverity } from '#src/contracts/plan/grade/FindingSeverity.ts';
import { StructuralCheck } from '#src/contracts/plan/grade/StructuralCheck.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';
import type { ParsedPlan } from '#src/plan/common/types/ParsedPlan.ts';

interface Params {
	/** The UNEXPANDED parsed plan: its file moves and folder moves as written. */
	plan: ParsedPlan;
	/** The finding label: this file's basename. */
	phase: string;
}

interface WrittenMove {
	move: { from: string; to: string };
	folder: boolean;
}

/** A folder contains every path under it; a file contains nothing but itself. */
const overlaps = ({ left, right, folders }: { left: string; right: string; folders: { left: boolean; right: boolean } }) =>
	left === right || (folders.left && right.startsWith(`${left}/`)) || (folders.right && left.startsWith(`${right}/`));

/** What makes a pair defective, or undefined when the two moves are independent. */
const defectOf = ({ first, second }: { first: WrittenMove; second: WrittenMove }) => {
	const folders = { left: first.folder, right: second.folder };
	const reversed = { left: second.folder, right: first.folder };
	let defect: string | undefined;

	if (overlaps({ left: first.move.from, right: second.move.from, folders })) {
		defect = 'both move from the same place';
	} else if (overlaps({ left: first.move.to, right: second.move.to, folders })) {
		defect = 'both land in the same place';
	} else if (
		overlaps({ left: first.move.to, right: second.move.from, folders }) ||
		overlaps({ left: second.move.to, right: first.move.from, folders: reversed })
	) {
		defect = 'one moves what the other lands or leaves, so the two chain or swap';
	}

	return defect;
};

const written = ({ move, folder }: WrittenMove) => {
	const slash = folder ? '/' : '';

	return `\`${move.from}${slash}\` → \`${move.to}${slash}\``;
};

const finding = ({ phase, first, second, defect }: { phase: string; first: WrittenMove; second: WrittenMove; defect: string }) => ({
	check: StructuralCheck.MoveWellFormed,
	severity: FindingSeverity.Blocking,
	phase,
	issue: `the moves ${written(first)} and ${written(second)} overlap: ${defect}, so which one wins cannot be told from the plan`,
	location: `${phase} → Files to Move`,
	fix: 'merge the two into one move, or split one of them into a later phase',
});

/**
 * Must be handed the unexpanded plan: on an expanded one every carried file
 * would overlap its own folder move. The parsed plan keeps no line numbers for
 * moves, so a defective pair is reported at the section, naming both moves.
 *
 * @returns the findings, one per defective pair in written order (file moves
 * first, then folder moves), and every move in a reported pair once
 */
export const checkMoveOverlaps = ({ plan, phase }: Params): { findings: StructuralFinding[]; flagged: { from: string; to: string }[] } => {
	const moves: WrittenMove[] = [...plan.movePaths.map((move) => ({ move, folder: false })), ...plan.folderMoves.map((move) => ({ move, folder: true }))];
	const findings: StructuralFinding[] = [];
	const flagged = new Set<WrittenMove>();

	for (const [index, first] of moves.entries()) {
		for (const second of moves.slice(index + 1)) {
			const defect = defectOf({ first, second });

			if (defect !== undefined) {
				findings.push(finding({ phase, first, second, defect }));
				flagged.add(first);
				flagged.add(second);
			}
		}
	}

	return { findings, flagged: moves.filter((entry) => flagged.has(entry)).map(({ move }) => ({ from: move.from, to: move.to })) };
};
