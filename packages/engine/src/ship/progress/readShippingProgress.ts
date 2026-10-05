import { readFile } from 'node:fs/promises';
import type { ShippingProgressReading } from '#src/common/types/ShippingProgressReading.ts';
import { ShippingProgress } from '#src/contracts/ship/ShippingProgress.ts';
import { getShippingProgressPath } from '#src/ship/progress/common/getShippingProgressPath.ts';

interface Params {
	/** Any checkout; the primary is resolved from it. */
	cwd: string;
	branch: string;
}

const isMissingFile = ({ error }: { error: unknown }) => typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';

/**
 * Never throws. Only `ENOENT` means missing; any other read failure, a body that
 * is not JSON, or one off the contract means the file is there and unreadable.
 */
export const readShippingProgress = async ({ cwd, branch }: Params): Promise<ShippingProgressReading> => {
	const path = await getShippingProgressPath({ cwd, branch });

	if (path === undefined) {
		return { path: undefined, exists: false, progress: undefined };
	}

	let exists = true;
	let progress: ShippingProgress | undefined;

	try {
		const parsed = ShippingProgress.safeParse(JSON.parse(await readFile(path, 'utf8')));

		progress = parsed.success ? parsed.data : undefined;
	} catch (error) {
		exists = !isMissingFile({ error });
	}

	return { path, exists, progress };
};
