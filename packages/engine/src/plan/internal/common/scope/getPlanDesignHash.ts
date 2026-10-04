import { canonicalJson } from '#src/common/canonicalJson.ts';
import { sha256 } from '#src/common/sha256.ts';
import type { ParsedPlan } from '#src/plan/internal/common/types/ParsedPlan.ts';

interface Params {
	plan: ParsedPlan;
	/** Generated regions kept in the hash because nothing else measures them on this call — the overview's per-phase sections when attribution failed. */
	keepRegions?: string[];
	/** Text that describes this file though it lives in the overview. */
	attributed?: string;
}

/** Last range first, so an earlier removal never shifts the lines a later one names. */
const droppedRanges = ({ plan, keepRegions }: { plan: ParsedPlan; keepRegions: string[] }) =>
	[...plan.generatedRegionRanges]
		.filter(([heading]) => !keepRegions.includes(heading))
		.map(([, range]) => range)
		.sort((left, right) => right.start - left.start);

/**
 * Generated regions are left out: the fingerprint already measures their record
 * row by row, so hashing them would report a reading stale for a reason no
 * reader could act on.
 *
 * The two texts are hashed over their canonical encoding rather than
 * concatenated, so a different split of the same characters cannot collide.
 */
export const getPlanDesignHash = ({ plan, keepRegions = [], attributed = '' }: Params): string => {
	const design = [...plan.lines];

	for (const { start, end } of droppedRanges({ plan, keepRegions })) {
		design.splice(start - 1, end - start + 1);
	}

	return sha256({ content: canonicalJson({ value: { design: design.join('\n'), attributed } }) });
};
