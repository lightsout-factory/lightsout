import type { RenameRule } from '#src/contracts/plan/renames/RenameRule.ts';

interface Params {
	text: string;
	renames: RenameRule[];
}

// Deliberately literal, not a regular expression: a plan must not be able to
// declare a rename too loose to prove anything.
export const applyRenames = ({ text, renames }: Params): string => renames.reduce((renamed, { from, to }) => renamed.replaceAll(from, to), text);
