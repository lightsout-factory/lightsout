interface Params {
	count: number;
}

export const plural = ({ count }: Params): string => (count === 1 ? '' : 's');
