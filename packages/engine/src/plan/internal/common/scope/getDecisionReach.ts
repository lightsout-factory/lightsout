import type { GradeDecisionLog } from '#src/contracts/plan/memory/GradeDecisionLog.ts';

type DecisionEntry = GradeDecisionLog['rows'][number];

interface Params {
	/** Absent when this pass could not read the overview. */
	current?: GradeDecisionLog;
	/** Absent when that pass was recorded without a decision-log part. */
	previous?: GradeDecisionLog;
	overviewFileChanged: boolean;
	edited: string[];
	phaseFiles: string[];
}

/** Each row of `other` pairs at most once, so a row repeated verbatim is matched once per copy. */
const unmatchedRows = ({ rows, other }: { rows: DecisionEntry[]; other: DecisionEntry[] }) => {
	const available = other.map((row) => row.sha256);

	return rows.filter((row) => {
		const index = available.indexOf(row.sha256);

		if (index !== -1) {
			available.splice(index, 1);
		}

		return index === -1;
	});
};

/** Rows sharing a changed row's question are joined, which is how a revision covers the phases its predecessor named. */
const joinedRows = ({ current, previous }: { current: GradeDecisionLog; previous: GradeDecisionLog }) => {
	const changed = [...unmatchedRows({ rows: current.rows, other: previous.rows }), ...unmatchedRows({ rows: previous.rows, other: current.rows })];
	const questions = new Set(changed.map((row) => row.questionSha256));
	const joinsChange = (row: DecisionEntry) => questions.has(row.questionSha256);

	return { changed, current: current.rows.filter(joinsChange), previous: previous.rows.filter(joinsChange) };
};

/**
 * Rows are compared as a multiset of row hashes rather than by position, so one
 * deleted row reads as one changed row rather than as every later row moving. A
 * reach that is not known comes back as an error, never as a narrower answer.
 *
 * A phase's own row and declaration block are credited to that phase's design
 * hash, so they move the overview's whole-file hash and arrive in `edited`,
 * which is why a file move beside an edited phase is placed rather than reported
 * unplaceable.
 */
export const getDecisionReach = ({ current, previous, overviewFileChanged, edited, phaseFiles }: Params): { phases: string[] } | { error: string } => {
	if (previous === undefined) {
		return { error: 'the earlier pass has no decision evidence to compare against' };
	}

	if (current === undefined) {
		return { error: 'this pass could not read the overview, so its decisions cannot be compared' };
	}

	if (current.overviewDesign === undefined || previous.overviewDesign === undefined) {
		return { error: 'one of the two passes never measured the shared design text of the overview, so it cannot be compared' };
	}

	if (current.overviewDesign !== previous.overviewDesign) {
		return { error: 'the overview changed outside every generated region and every per-phase span, and that is context every phase shares' };
	}

	const joined = joinedRows({ current, previous });

	if (overviewFileChanged && joined.changed.length === 0 && edited.length === 0) {
		return { error: 'the overview moved but no decision row changed, so where the change reaches cannot be placed' };
	}

	const rows = [...joined.current, ...joined.previous];

	if (rows.some((row) => row.phases === undefined)) {
		return { error: 'a changed decision names no phases, so it may reach the whole plan' };
	}

	const named = [...new Set(rows.flatMap((row) => row.phases ?? []))].sort();
	const unknown = named.filter((phase) => !phaseFiles.includes(phase));

	if (unknown.length > 0) {
		return { error: `a changed decision names ${unknown.join(', ')}, which is not a phase file of this plan` };
	}

	if (edited.length > 0 && joined.previous.length > 0) {
		return { error: 'a superseded or removed decision named phases while phase text also changed, so the connections its scope ran along may be gone' };
	}

	return { phases: named };
};
