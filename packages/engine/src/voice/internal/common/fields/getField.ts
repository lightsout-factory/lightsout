interface Params {
	value: unknown;
	key: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
	return typeof value === 'object' && value !== null;
};

export const getField = ({ value, key }: Params): unknown => {
	return isRecord(value) ? value[key] : undefined;
};
