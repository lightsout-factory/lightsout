import { readFile } from 'node:fs/promises';
import { messageOf } from '#src/common/messageOf.ts';

interface Params {
	configPath: string;
}

/**
 * Structural rather than `instanceof Error`: jest hands test code a realm whose
 * `Error` is not the one `node:fs/promises` throws.
 */
const isMissing = ({ error }: { error: unknown }) => typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';

export const readConfigFile = async ({ configPath }: Params): Promise<string | undefined> => {
	try {
		return await readFile(configPath, 'utf8');
	} catch (error) {
		if (isMissing({ error })) {
			return undefined;
		}

		throw new Error(`lightsout.config.json at ${configPath} could not be read — ${messageOf({ error })}`);
	}
};
