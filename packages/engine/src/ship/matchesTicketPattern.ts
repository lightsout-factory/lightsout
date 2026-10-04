import { readTicketMatch } from '#src/ship/common/readTicketMatch.ts';

interface Params {
	branch: string;
	ticketPattern: RegExp;
}

/**
 * Narrows to a boolean: the capture groups `readTicketMatch` answers belong to
 * ship's pull request body and must not cross ship's boundary.
 */
export const matchesTicketPattern = ({ branch, ticketPattern }: Params): boolean => readTicketMatch({ branch, ticketPattern }) !== undefined;
