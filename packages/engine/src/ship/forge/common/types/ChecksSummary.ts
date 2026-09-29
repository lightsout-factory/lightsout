export interface ChecksSummary {
	/** True when every required check has finished. */
	finished: boolean;
	/** True when every finished check passed. Meaningless while `finished` is false. */
	green: boolean;
	failing: string[];
	pending: string[];
	/**
	 * A skipped check counts as passing. Carried because "the forge lists no
	 * checks" and "every listed check passed" otherwise fold alike, and
	 * `waitForChecks` must not merge before CI has registered.
	 */
	passing: string[];
	/**
	 * False when the forge's answer could not be read: a login prompt and an
	 * empty list fold to the same fields, and only an empty list may become a
	 * missing-CI verdict.
	 */
	readable: boolean;
}
