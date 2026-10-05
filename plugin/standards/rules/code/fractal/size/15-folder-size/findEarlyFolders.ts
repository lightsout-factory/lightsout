import type { RawStandardsFinding } from '@lightsout/standards-contracts';
import { bannedFolderNames } from '#common/constants/bannedFolderNames.ts';
import { buildRawFinding } from '#common/findings/buildRawFinding.ts';
import { getExportName } from '#common/naming/getExportName.ts';
import { getBaseName } from '#common/paths/getBaseName.ts';
import { getDirectory } from '#common/paths/getDirectory.ts';

interface Params {
	/** Every source file to judge: no tests, no index files. */
	files: string[];
	cap: number;
}

/** A folder holding a file of its own name is a module folder. */
const isMainFile = ({ file }: { file: string }) => getExportName({ path: file }) === getBaseName({ path: getDirectory({ path: file }) });

/**
 * Each folder on a file's path that holds its files directly until it is over
 * the cap, a `common/` or a module folder, with the part of the path below it.
 */
const splitAtHosts = ({ file, moduleFolders }: { file: string; moduleFolders: Set<string> }) => {
	const segments = file.split('/');

	return segments.flatMap((segment, index) => {
		const host = segments.slice(0, index + 1).join('/');
		const isHost = index < segments.length - 1 && (segment === 'common' || moduleFolders.has(host));

		return isHost ? [{ host, below: segments.slice(index + 1) }] : [];
	});
};

/** The folders a host may always hold: a nested `common/`, and the two folders of a `common/` that hold one kind of code. */
const standingFolders = new Set(['common', 'types', 'constants']);

/**
 * A subject folder in a `common/` or a module folder that holds 20 files or
 * fewer. A module folder inside counts once towards the total, as the one
 * module it is, and `types/` and `constants/` not at all, since grouping by
 * subject is for functions. A folder with a banned name is the folder-name
 * rule's to report, so it is left out here: one wrong folder is one finding.
 */
export const findEarlyFolders = ({ files, cap }: Params): RawStandardsFinding[] => {
	const moduleFolders = new Set(files.filter((file) => isMainFile({ file })).map((file) => getDirectory({ path: file })));
	const foldersByHost = new Map<string, Map<string, string[]>>();
	const sizeByHost = new Map<string, number>();

	for (const file of files) {
		for (const { host, below } of splitAtHosts({ file, moduleFolders })) {
			const [child = '', ...rest] = below;
			const isChildModule = moduleFolders.has(`${host}/${child}`);

			if (rest.length === 0 || (isChildModule && rest.length === 1 && isMainFile({ file }))) {
				sizeByHost.set(host, (sizeByHost.get(host) ?? 0) + 1);
			}

			if (rest.length > 0 && !isChildModule && !standingFolders.has(child) && !bannedFolderNames.has(child)) {
				const folders = foldersByHost.get(host) ?? new Map<string, string[]>();

				foldersByHost.set(host, folders.set(child, [...(folders.get(child) ?? []), file]));
			}
		}
	}

	return [...foldersByHost].flatMap(([host, folders]) => {
		const size = (sizeByHost.get(host) ?? 0) + [...folders.values()].reduce((total, paths) => total + paths.length, 0);

		return size > cap
			? []
			: [...folders.keys()].map((name) =>
					buildRawFinding({
						rule: 'folder-size',
						files: [{ path: `${host}/${name}` }],
						detail: `folder '${name}' groups files in a folder that holds ${size} (cap ${cap})`,
						guidance: 'Move its files up beside the others. A `common/` or a module folder is grouped by subject only once it holds more files than the cap.',
					}),
				);
	});
};
