export interface CoverageCollection {
	/** Absolute, resolved Jest rootDir — every glob in collectCoverageFrom is written against it. */
	rootDir: string;
	/** Undefined when the key is absent: Jest then measures only what a test imports, and the engine cannot predict the set. */
	collectCoverageFrom: string[] | undefined;
	/** Regular-expression sources matched against the absolute path. */
	coveragePathIgnorePatterns: string[];
}
