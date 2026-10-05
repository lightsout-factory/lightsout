interface Params {
	firstName: string;
	lastName: string;
}

// Correct: an arrow function, like every other function in the codebase.
export const getDisplayName = ({ firstName, lastName }: Params): string => {
	return `${firstName} ${lastName}`;
};
