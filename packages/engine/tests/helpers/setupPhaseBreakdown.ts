import { type DeclarationSpec, overviewBody } from '#tests/helpers/phasePlan.ts';

/** One `## Phases` row whose every cell reads cleanly — the shape a defect case bends one field of. */
const cleanRow: DeclarationSpec = { number: 1, file: 'phase1-core.md', created: 1, touched: 2 };

interface Params {
	/** The `## Phases` rows the overview is built from; defaults to one clean row. */
	rows?: DeclarationSpec[];
	/** Rewrites the built overview text, for a case that bends its shape rather than a row. */
	overview?: (params: { text: string }) => string;
	/** The configured executor-file-limit the advisory budget note is measured against. */
	executorFileLimit?: number;
}

/** The phase-breakdown door check's input as the phased draft calls it, over an overview built from `rows` or handed in verbatim. */
export const setupPhaseBreakdown = ({ rows = [cleanRow], overview, executorFileLimit = 50 }: Params = {}) => {
	const text = overviewBody({ rows });

	return { overviewText: overview ? overview({ text }) : text, overviewBase: 'overview.md', executorFileLimit };
};
