interface Params {
	/** A human reference, e.g. 'LO-70' or 'lo-70'. */
	identifier: string;
	/** The configured tracker prefix, matched case-insensitively. */
	ticketPrefix: string;
}

/** @returns the ticket's number as written, or undefined when the identifier names no ticket under this prefix */
export const parseTicketNumber = ({ identifier, ticketPrefix }: Params): string | undefined => {
	const [prefix, number] = identifier.split('-');

	return prefix?.toLowerCase() === ticketPrefix.toLowerCase() && /^\d+$/u.test(number ?? '') ? number : undefined;
};
