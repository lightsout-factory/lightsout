import { CheckKind } from '#src/common/constants/CheckKind.ts';

interface Params {
	/** The engine's own flag: true when a rule ships code that decides it. */
	checked: boolean;
	/** The engine's own flag: true when an agent reviews the rule; with `checked`, the code decides only part of it. */
	reviewed: boolean;
}

/** Every kind of check a rule has, deterministic first: one for most rules, both for a rule code decides only part of. */
export const toCheckKinds = ({ checked, reviewed }: Params): CheckKind[] => [
	...(checked ? [CheckKind.Deterministic] : []),
	...(reviewed ? [CheckKind.Agent] : []),
];
