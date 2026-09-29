import type { FrameworkCarveOut } from '../types/FrameworkCarveOut.ts';

interface Params {
	carveOut: FrameworkCarveOut;
}

/**
 * The banned-name and casing rules govern a package's SOURCE tree, while a
 * check is handed every JS/TS file in the repo; without this anchor a repo's own
 * `tests/helpers/` and fixture trees would report as violations.
 */
export const getSourceRoot = ({ carveOut }: Params): string => (carveOut.directory === '.' ? 'src/' : `${carveOut.directory}/src/`);
