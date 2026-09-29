interface Params {
	/** ISO timestamp, as every manifest and ledger line records one. */
	at: string;
	days: number;
}

/**
 * Trailing rather than calendar, so the window means one thing in every
 * timezone and on every weekday. An unreadable timestamp is outside every window.
 */
export const isWithinLastDays = ({ at, days }: Params): boolean => {
	const hoursPerDay = 24;
	const parsed = new Date(at).getTime();

	return !Number.isNaN(parsed) && Date.now() - parsed <= days * hoursPerDay * 60 * 60 * 1000;
};
