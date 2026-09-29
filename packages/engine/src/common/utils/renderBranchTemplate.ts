import { toBranchSlug } from '#src/common/utils/toBranchSlug.ts';

interface Params {
	/** The repository's branch template — `{ticket}` and `{slug}` tokens. */
	template: string;
	/** The ticket reference, in whatever case the tracker or the user wrote it. Absent when no ticket names the work. */
	ticketRef?: string;
	/** The ticket's title or heading, slugged into the `{slug}` token. */
	title: string;
}

/**
 * The single characters a template may put between its tokens. Named rather
 * than written as "anything that is not a letter or a digit", so dropping a
 * token can never eat the brace of the token beside it.
 */
const separator = '[-_/.]';

/**
 * The token goes with the separator that follows it, so a prefixed template
 * still names a git namespace: `feature/{ticket}-{slug}` renders
 * `feature/add-search-basics`, not `feature-add-search-basics`. When the token
 * ends the template, the trailing trim drops the separator before it.
 */
const dropTicketToken = ({ template }: { template: string }) =>
	template.replaceAll(new RegExp(`\\{ticket\\}${separator}?`, 'gu'), '').replaceAll(new RegExp(`^${separator}+|${separator}+$`, 'gu'), '');

/**
 * An unknown token is left as written, matching ship's `pr-body` template. The
 * output must match `ship.ticket-pattern`: the two keys are configured
 * together, and that pairing links the ticket, worktree, commits and pull
 * request. Most repositories have no ticket system, so a missing reference
 * drops the `{ticket}` token rather than refusing.
 */
export const renderBranchTemplate = ({ template, ticketRef, title }: Params): string => {
	const slugged = template.replaceAll('{slug}', toBranchSlug({ text: title }));

	return ticketRef === undefined ? dropTicketToken({ template: slugged }) : slugged.replaceAll('{ticket}', ticketRef.toLowerCase());
};
