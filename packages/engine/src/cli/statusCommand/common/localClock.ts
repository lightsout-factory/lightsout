interface Params {
	iso: string;
}

/** Local time, because a reader compares it against the clock on their own screen. */
export const localClock = ({ iso }: Params): string => {
	const at = new Date(iso);

	return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
};
