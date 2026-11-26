interface Params {
	/** Something on the page is being written by a live process right now. */
	live: boolean;
}

/** Idle state is never rescanned: a page polls only while what it shows can still change. */
export const pollWhileLive = ({ live }: Params): number | false => {
	const intervalMs = 5_000;

	return live ? intervalMs : false;
};
