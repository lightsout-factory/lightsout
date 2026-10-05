/**
 * Not a `PriorArtCandidate`: a collision is computed before any file is written,
 * so it has no planned path or phase file.
 */
export interface ExportCollision {
	symbol: string;
	/** Never empty — a symbol with no match yields no collision. */
	collidesWith: Array<{ name: string; path: string }>;
}
