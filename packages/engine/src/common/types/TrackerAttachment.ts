/** Nothing above the seam sees a tracker's types, so swapping trackers stays a change inside this folder. */
export interface TrackerAttachment {
	/** What a delete keys on. */
	id: string;
	/** Publish writes the durable file's own name here, and the fetch matches on it. */
	title: string;
	/** The permanent asset URL the bytes are read from. */
	url: string;
}
