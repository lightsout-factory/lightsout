interface ConstructorParams {
	/** The library that was searched. */
	name: string;
	rule: string;
}

/** A rule page's address names a rule the bundled library does not hold; the page turns this into its not-found answer. */
export class StandardsPackRuleNotFoundError extends Error {
	constructor({ name, rule }: ConstructorParams) {
		super(`standards pack "${name}" holds no rule named "${rule}"`);
		this.name = 'StandardsPackRuleNotFoundError';
	}
}
