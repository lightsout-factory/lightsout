import { toBranchSlug } from '#src/common/toBranchSlug.ts';

interface Params {
	/** Absent for a work order named from words alone. */
	ticketRef?: string;
	/** The words that name the work — summarised from a ticket's title, or typed by the caller. */
	words: string;
}

/**
 * Both halves go through `toBranchSlug`, so a label is always one path segment
 * by construction and a branch template's prefix can never reach a folder path.
 */
export const composeWorkOrderName = ({ ticketRef, words }: Params): { name: string } | { error: string } => {
	const slugged = toBranchSlug({ text: words });

	if (slugged === '') {
		return { error: `'${words}' holds nothing a work order can be named after: a label is lowercase letter-and-digit words joined by single hyphens` };
	}

	const reference = ticketRef === undefined ? '' : toBranchSlug({ text: ticketRef });

	return { name: [reference, slugged].filter((segment) => segment !== '').join('-') };
};
