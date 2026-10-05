interface Params {
	firstName: string;
	lastName: string;
}

// Incorrect: a `function` declaration, in a codebase whose functions are arrows.
export function getDisplayName({ firstName, lastName }: Params): string {
	return `${firstName} ${lastName}`;
}
