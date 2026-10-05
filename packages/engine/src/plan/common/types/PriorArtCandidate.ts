/** A local shape, not a persisted contract: merged with the agent's verdict into a `DedupFinding` downstream. */
export interface PriorArtCandidate {
	plannedSymbol: string;
	/** Repo-relative. */
	plannedPath: string;
	phase: string;
	collidesWith: Array<{ name: string; path: string }>;
}
