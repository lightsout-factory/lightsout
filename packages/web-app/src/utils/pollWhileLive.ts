interface Params {
	/** Something on the page is being written by a live process right now. */
	live: boolean;
	/** How often to poll while live; defaults to five seconds. */
	intervalMs?: number;
}

/** Idle state is never rescanned: a page polls only while what it shows can still change. */
export const pollWhileLive = ({ live, intervalMs = 5_000 }: Params): number | false => (live ? intervalMs : false);
