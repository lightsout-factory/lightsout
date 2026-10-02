import type { RawStandardsFinding } from '#src/RawStandardsFinding.ts';
import type { StandardsCheckInputs } from '#src/StandardsCheckInputs.ts';

export type StandardsCheckFunction = (params: {
	/** One built input per kind the check declared. */
	inputs: StandardsCheckInputs;
	/** The rule's resolved numeric options — the rule.md defaults under any config override. */
	options: Record<string, number>;
}) => RawStandardsFinding[] | Promise<RawStandardsFinding[]>;
