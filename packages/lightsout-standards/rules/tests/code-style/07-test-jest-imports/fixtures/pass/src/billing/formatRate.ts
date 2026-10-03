interface Params {
	value: number;
}

export const formatRate = ({ value }: Params): string => `${value * 100}%`;
