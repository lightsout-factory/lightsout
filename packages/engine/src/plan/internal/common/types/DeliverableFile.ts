/** Distinct from `PhaseFile`, which is a *parsed* plan file: this is the raw text, before anything reads it. */
export interface DeliverableFile {
	/** Absolute path on disk. */
	path: string;
	text: string;
}
