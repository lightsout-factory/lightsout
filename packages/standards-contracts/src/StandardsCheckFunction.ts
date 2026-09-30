import type { RawStandardsFinding } from '#src/RawStandardsFinding.ts';
import type { StandardsCheckInput } from '#src/StandardsCheckInput.ts';

export type StandardsCheckFunction = (params: {
	input: StandardsCheckInput;
	/** The rule's resolved numeric options — the rule.md defaults under any config override. */
	options: Record<string, number>;
}) => RawStandardsFinding[] | Promise<RawStandardsFinding[]>;
