import type { GradeInputs } from '#src/contracts/plan/memory/GradeInputs.ts';

interface Params {
	inputs: GradeInputs;
}

/** An unmeasured file is absent rather than given a placeholder: absent never compares equal to a recorded entry, so it falls out of coverage. */
export const getDesignHashes = ({ inputs }: Params): Map<string, string> =>
	new Map(inputs.planFiles.flatMap(({ file, designSha256 }) => (designSha256 === undefined ? [] : [[file, designSha256] as const])));
