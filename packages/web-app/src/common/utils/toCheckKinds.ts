import { CheckKind } from '#src/common/constants/CheckKind.ts';

interface Params {
	/** The engine's own flag: true when the rule has a deterministic check. */
	deterministic: boolean;
	/** The engine's own flag: true when the rule has an agent check; with `deterministic`, the code decides only part of it. */
	agent: boolean;
}

/** Every kind of check a rule has, deterministic first: one for most rules, both for a rule code decides only part of. */
export const toCheckKinds = ({ deterministic, agent }: Params): CheckKind[] => [
	...(deterministic ? [CheckKind.Deterministic] : []),
	...(agent ? [CheckKind.Agent] : []),
];
