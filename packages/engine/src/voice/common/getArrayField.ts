import { getField } from '#src/voice/common/getField.ts';

interface Params {
	value: unknown;
	key: string;
}

export const getArrayField = ({ value, key }: Params): unknown[] => {
	const field = getField({ value, key });

	return Array.isArray(field) ? field : [];
};
