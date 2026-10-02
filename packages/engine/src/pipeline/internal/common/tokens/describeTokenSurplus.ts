interface Params {
	more: Map<string, number>;
	less: Map<string, number>;
}

// Capped so one rewritten file cannot bury the others in the refusal message.
export const describeTokenSurplus = ({ more, less }: Params): string => {
	const listedTokenLimit = 20;
	const surplus = [...more].flatMap(([token, count]) => (count > (less.get(token) ?? 0) ? [`\`${token}\` ×${count - (less.get(token) ?? 0)}`] : []));
	const listed = surplus.slice(0, listedTokenLimit).join(', ');

	return surplus.length > listedTokenLimit ? `${listed} and ${surplus.length - listedTokenLimit} more` : listed;
};
