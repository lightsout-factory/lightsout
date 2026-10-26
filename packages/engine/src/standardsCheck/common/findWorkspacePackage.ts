import { packageOf } from '#src/common/workspace/packageOf.ts';

interface Params {
	/** A repo-relative path, `/`-separated. */
	file: string;
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
 * The workspace package holding a repo-relative path, or the package a path
 * naming a package folder itself names.
 *
 * @returns The package folder name, or undefined for a path outside the
 * packages directory or under a folder there that is not a workspace package.
 */
export const findWorkspacePackage = ({ file, packagesDir, workspacePackages }: Params): string | undefined => {
	const name = packageFolderOf({ file, packagesDir });

	return name !== undefined && workspacePackages.includes(name) ? name : undefined;
};
