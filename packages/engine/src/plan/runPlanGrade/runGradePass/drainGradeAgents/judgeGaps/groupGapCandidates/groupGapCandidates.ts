import { basename } from 'node:path';
import { groupConnectedFiles } from '#src/common/fileGroups/groupConnectedFiles.ts';
import { findingLocations } from '#src/common/findings/findingLocations.ts';
import type { GradedGap } from '#src/contracts/plan/grade/GradedGap.ts';
import type { DeliverableFile } from '#src/plan/common/types/DeliverableFile.ts';
import type { GapBatch } from '#src/plan/runPlanGrade/runGradePass/drainGradeAgents/judgeGaps/common/types/GapBatch.ts';
import { distinctiveWords } from '#src/plan/runPlanGrade/runGradePass/drainGradeAgents/judgeGaps/groupGapCandidates/distinctiveWords.ts';
import { gapBatchLimits } from '#src/plan/runPlanGrade/runGradePass/drainGradeAgents/judgeGaps/groupGapCandidates/gapBatchLimits.ts';

interface Params {
	gaps: GradedGap[];
	/** EVERY plan file, not the readers' selection. A finding none of whose locations names one of them is in no batch. */
	files: DeliverableFile[];
}

interface Candidate {
	id: string;
	index: number;
	gap: GradedGap;
	locations: Array<{ phase: string; text: string }>;
	words: Set<string>;
}

/**
 * A stale location is dropped rather than the whole finding, so a grouped record
 * stays judgeable at the plan files that still exist. A finding left with no
 * location reaches the join unjudged, which blocks.
 */
const candidatesOf = ({ gaps, files }: Params): Candidate[] =>
	gaps.flatMap((gap, index) => {
		const locations = findingLocations({ observations: gap.observations, phase: gap.phase }).flatMap((phase) => {
			const file = files.find((candidate) => basename(candidate.path) === phase);

			return file === undefined ? [] : [{ phase, text: file.text }];
		});

		return locations.length === 0 ? [] : [{ id: `o${index + 1}`, index, gap, locations, words: distinctiveWords({ text: `${gap.gap} ${gap.decision}` }) }];
	});

/**
 * Deliberately no phase, lens or area requirement: area is a label the lens
 * assigns, so requiring one would keep apart exactly the cross-phase
 * contradiction a single judge has to see whole.
 */
const relatedPairs = ({ candidates }: { candidates: Candidate[] }) => {
	const minimumSharedWords = 2;

	return candidates.flatMap((first, position) =>
		candidates
			.slice(position + 1)
			.filter((second) => [...first.words].filter((word) => second.words.has(word)).length >= minimumSharedWords)
			.map((second) => ({ from: first.id, to: second.id })),
	);
};

const spannedLocations = ({ members }: { members: Candidate[] }) => [
	...new Map(members.flatMap((member) => member.locations).map((location) => [location.phase, location])).values(),
];

const splitGroup = ({ members }: { members: Candidate[] }) => {
	const batches: Candidate[][] = [];

	for (const member of members) {
		const last = batches.at(-1);
		const fits =
			last !== undefined &&
			last.length < gapBatchLimits.maxObservations &&
			spannedLocations({ members: [...last, member] }).length <= gapBatchLimits.maxPlanFiles;

		if (fits) {
			last.push(member);
		} else {
			batches.push([member]);
		}
	}

	return batches;
};

/**
 * A batch's plan texts are the same union of `findingLocations` that the
 * plan-file cap counts and `accountBatchVerdicts` demands a citation for, so a
 * citation is never demanded against text the judge was not given. The text
 * comes from every plan file, because a carried record may name a file no reader
 * read this pass.
 *
 * Output order follows the findings, never `Map` iteration, so two runs of the
 * same inputs batch the same way.
 */
export const groupGapCandidates = ({ gaps, files }: Params): GapBatch[] => {
	const candidates = candidatesOf({ gaps, files });
	const components = groupConnectedFiles({ files: candidates.map(({ id }) => id), edges: relatedPairs({ candidates }) });
	const groups = components
		.map((component) => {
			const members = new Set(component);

			return candidates.filter(({ id }) => members.has(id));
		})
		.sort((first, second) => first[0].index - second[0].index);

	return groups.flatMap((members) =>
		splitGroup({ members }).map((batch) => ({
			observations: batch.map(({ id, index, gap }) => ({ id, index, gap })),
			planTexts: spannedLocations({ members: batch }),
		})),
	);
};
