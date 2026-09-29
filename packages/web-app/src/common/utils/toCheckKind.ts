import { CheckKind } from '#src/common/constants/CheckKind.ts';

interface Params {
	/** The engine's own flag: true when a rule ships code that decides it. */
	checked: boolean;
}

export const toCheckKind = ({ checked }: Params): CheckKind => (checked ? CheckKind.Deterministic : CheckKind.Agent);
