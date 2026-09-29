import type { RawStandardsFinding } from '#src/RawStandardsFinding.ts';
import type { StandardsCheckInput } from '#src/StandardsCheckInput.ts';

export type StandardsCheckFunction = (params: {
	input: StandardsCheckInput;
	/** The rule's resolved numeric settings — front-matter defaults under any config override. */
	settings: Record<string, number>;
}) => RawStandardsFinding[] | Promise<RawStandardsFinding[]>;
