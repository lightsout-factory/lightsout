import { z } from 'zod';
import { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { configKeyDescriptions } from '#src/views/internal/common/constants/configKeyDescriptions.ts';

/**
 * Widened at the assignment rather than cast at each use: `LightsoutConfig.shape`
 * is a generic mapped type with no index signature for a `string` key.
 */
const configSchemaFields: Record<string, z.ZodType> = LightsoutConfig.shape;

const unwrapOptional = ({ schema }: { schema: z.ZodType }) => (schema instanceof z.ZodOptional ? schema.unwrap() : schema);

/** Follows a dot into a block, for the `timeouts.` leaves. */
const findKeySchema = ({ key }: { key: string }) => {
	const [head, ...blockSegments] = key.split('.');
	let field: z.ZodType | undefined = configSchemaFields[head];

	for (const segment of blockSegments) {
		const block = field === undefined ? undefined : unwrapOptional({ schema: field });

		if (block instanceof z.ZodObject) {
			const blockFields: Record<string, z.ZodType> = block.shape;

			field = blockFields[segment];
		} else {
			field = undefined;
		}
	}

	return field;
};

const toCell = ({ text }: { text: string }) => text.replaceAll('|', '\\|');

/**
 * The Required column is read from `LightsoutConfig` rather than hand-written,
 * which would be a second fact to keep in step.
 *
 * @returns no leading or trailing newline: the script owns the blank lines around the table
 */
export const renderConfigKeyReference = (): string => {
	const rows = Object.entries(configKeyDescriptions).map(([key, description]) => {
		const field = findKeySchema({ key });
		const required = field !== undefined && !field.safeParse(undefined).success;

		return `| \`${key}\` | ${required ? 'yes' : 'no'} | ${toCell({ text: description })} |`;
	});

	return ['| Field | Required | What it controls |', '| --- | ---: | --- |', ...rows].join('\n');
};
