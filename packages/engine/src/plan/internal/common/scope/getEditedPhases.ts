import { canonicalJson } from '#src/common/canonicalJson.ts';
import type { GradeInputs } from '#src/contracts/plan/memory/GradeInputs.ts';

interface Params {
	current: GradeInputs;
	previous: GradeInputs;
}

type PlanFileEntry = GradeInputs['planFiles'][number];

/** A file present on one side and not the other reads as changed rather than as missing. */
const hashesOf = ({ inputs }: { inputs: GradeInputs }) => new Map(inputs.planFiles.map((entry) => [entry.file, entry]));

/** An absent design hash on EITHER side counts as moved: a fingerprint that measured no design is not evidence the design is unchanged. */
const designMoved = ({ current, previous }: { current?: PlanFileEntry; previous?: PlanFileEntry }) =>
	current?.designSha256 === undefined || previous?.designSha256 === undefined || current.designSha256 !== previous.designSha256;

/**
 * An absent `changedFiles` or `gradedCommit` on EITHER side counts as differing:
 * reading an unread probe as clean would let a focused pass narrow against a
 * code state nobody measured.
 */
const otherInputMoved = ({ current, previous }: Params) =>
	current.changedFiles === undefined ||
	previous.changedFiles === undefined ||
	current.gradedCommit === undefined ||
	previous.gradedCommit === undefined ||
	current.gradedCommit !== previous.gradedCommit ||
	canonicalJson({ value: current.changedFiles }) !== canonicalJson({ value: previous.changedFiles }) ||
	current.standards !== previous.standards ||
	current.config !== previous.config ||
	current.prompts !== previous.prompts ||
	current.model !== previous.model ||
	current.effort !== previous.effort;

/**
 * The overview is kept out of `edited`, or the closure walk would look for a
 * phase named `overview.md`. `overviewFileChanged` uses the whole-file hash so
 * `getDecisionReach` can tell a generated Decision Log change from a design
 * change; a per-phase span of the overview moving shows up as that phase being
 * edited.
 */
export const getEditedPhases = ({ current, previous }: Params): { edited: string[]; overviewFileChanged: boolean; otherInputChanged: boolean } => {
	const overviewBase = 'overview.md';
	const currentHashes = hashesOf({ inputs: current });
	const previousHashes = hashesOf({ inputs: previous });
	const edited: string[] = [];
	let overviewFileChanged = false;

	for (const file of [...new Set([...currentHashes.keys(), ...previousHashes.keys()])].sort()) {
		const currentEntry = currentHashes.get(file);
		const previousEntry = previousHashes.get(file);

		if (file === overviewBase) {
			overviewFileChanged = currentEntry?.sha256 !== previousEntry?.sha256;
		} else if (designMoved({ current: currentEntry, previous: previousEntry })) {
			edited.push(file);
		}
	}

	return { edited, overviewFileChanged, otherInputChanged: otherInputMoved({ current, previous }) };
};
