interface ConstructorParams {
	/** The pack that was found. */
	name: string;
	rule: string;
}

/** Separate from `StandardsPackNotFoundError` so a page can say which half of the address was wrong. */
export class StandardsPackRuleNotFoundError extends Error {
	constructor({ name, rule }: ConstructorParams) {
		super(`standards pack "${name}" holds no rule named "${rule}"`);
		this.name = 'StandardsPackRuleNotFoundError';
	}
}
