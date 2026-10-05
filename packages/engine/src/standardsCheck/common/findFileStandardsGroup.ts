import type { StandardsGroup } from '#src/common/types/StandardsGroup.ts';
import { packageOf } from '#src/common/workspace/packageOf.ts';

interface Params {
	/** The repo-relative first file of a finding; undefined when the finding names no file. */
	file: string | undefined;
	groups: StandardsGroup[];
	/** Monorepo package parent dir (config['packages-dir'] ?? defaultPackagesDir). */
	packagesDir: string;
	/** The folder names `listWorkspacePackages` returns, listed once by the caller. */
	workspacePackages: string[];
}

/** A finding about a package folder names the folder itself, which `packageOf` leaves to no package. */
const packageFolderOf = ({ file, packagesDir }: { file: string; packagesDir: string }) => {
	const prefix = `${packagesDir}/`;
	const rest = file.startsWith(prefix) ? file.slice(prefix.length) : '';

	return rest !== '' && !rest.includes('/') ? rest : packageOf({ file, packagesDir });
};

/**
 * The group whose pack grades a finding: the one holding the package its first
 * file lives in. A file outside the packages directory, in a folder there that
 * is not a workspace package, or no file at all belongs to the repo root group.
 *
 * @returns The group, or undefined when no group covers that package: it is
 * outside the command's scope, or `standards-pack` is `false` and nothing names it.
 */
export const findFileStandardsGroup = ({ file, groups, packagesDir, workspacePackages }: Params): StandardsGroup | undefined => {
	const name = file === undefined ? undefined : packageFolderOf({ file, packagesDir });
	const key = name !== undefined && workspacePackages.includes(name) ? name : '';

	return groups.find((group) => group.packages.includes(key));
};
