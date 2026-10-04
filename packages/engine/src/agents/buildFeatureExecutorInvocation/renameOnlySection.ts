import { listSection } from '#src/agents/common/listSection.ts';
import type { RenameRule } from '#src/contracts/plan/renames/RenameRule.ts';

interface Params {
	/** The plan's declared renames, in declared order. */
	renames?: RenameRule[];
}

/**
 * The standing brief says every test edit is reviewed by an agent, which is not
 * true for this phase, so this section says so plainly.
 */
export const renameOnlySection = ({ renames = [] }: Params): string | undefined =>
	listSection({
		heading: 'Rename-only phase',
		intro: 'This phase only renames. These are its renames, in the order they are applied:',
		items: renames.map(({ from, to }) => `- \`${from}\` → \`${to}\``),
		rules: [
			'- Apply exactly these renames and nothing else — to file paths and file contents alike, each a literal, case-sensitive replacement of every occurrence, in the order listed.',
			'- Move a renamed file rather than copying it: its old path must be gone.',
			'- Write no tests, and change nothing a rename does not explain.',
			"- Before any gate runs, the engine compares every changed file against the phase's starting commit after applying these renames to both sides, and refuses any other change.",
			"- That rename check runs in place of the agent test-change review the standing brief describes: no agent reviews this phase's test edits, and the check refuses any edit the renames do not explain.",
		],
	});
