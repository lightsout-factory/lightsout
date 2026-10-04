interface Params {
	branch: string;
	ticketPattern: RegExp;
}

/**
 * The whole record feeds the pull request body template, so a convention like `lo-60` can also
 * yield a bare `60`. A group that did not capture is dropped, so a template naming it stays
 * visibly unsubstituted.
 */
export const readTicketMatch = ({ branch, ticketPattern }: Params): Record<string, string> | undefined => {
	const groups = ticketPattern.exec(branch)?.groups;
	const captured = Object.entries(groups ?? {}).filter((entry): entry is [string, string] => entry[1] !== undefined);

	return captured.some(([name]) => name === 'ticket') ? Object.fromEntries(captured) : undefined;
};
