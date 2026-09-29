/**
 * `providedBefore` and `removedBefore` hold what STRICTLY EARLIER phases did, so
 * a phase is never treated as its own predecessor.
 *
 * Both sets are NET, not cumulative: a file deleted by phase 2, recreated by
 * phase 3 and modified by phase 4 is legal, and cumulative sets would have
 * phase 4's modify collide with phase 2's delete.
 */
export interface PhaseProvenance {
	providedBefore: Map<string, Set<string>>;
	removedBefore: Map<string, Set<string>>;
	/** Path → the phase that most recently creates it or moves to it. */
	createdBy: Map<string, string>;
	/** Path → the phase that most recently deletes it or moves it away. */
	removedBy: Map<string, string>;
}
