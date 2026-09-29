import type { StandardsPackView } from '#src/contracts/views/StandardsPackView.ts';
import { toStandardsPackView } from '#src/views/common/utils/toStandardsPackView.ts';
import { getStandardsPackBundle } from '#src/views/getStandardsPackBundle.ts';

interface Params {
	cwd: string;
	name: string;
}

/**
 * @throws {StandardsPackNotFoundError} When no pack this repo loads answers to the name.
 */
export const getStandardsPackView = async ({ cwd, name }: Params): Promise<StandardsPackView> => {
	const bundle = await getStandardsPackBundle({ cwd, name });

	return toStandardsPackView({ bundle });
};
