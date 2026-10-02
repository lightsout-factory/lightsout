import { CheckKind } from '#src/common/constants/CheckKind.ts';

interface Params {
	/** The engine's own flag: true when a rule ships code that decides it. */
	checked: boolean;
	/** The engine's own flag: true when an agent reviews the rule, which with `checked` means the code decides only part of it. */
	reviewed: boolean;
}

export const toCheckKind = ({ checked, reviewed }: Params): CheckKind => {
	if (checked && reviewed) {
		return CheckKind.Both;
	}

	return checked ? CheckKind.Deterministic : CheckKind.Agent;
};
