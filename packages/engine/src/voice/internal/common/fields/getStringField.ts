import { getField } from '#src/voice/internal/common/fields/getField.ts';

interface Params {
	value: unknown;
	key: string;
}

export const getStringField = ({ value, key }: Params): string | undefined => {
	const field = getField({ value, key });

	return typeof field === 'string' ? field : undefined;
};
