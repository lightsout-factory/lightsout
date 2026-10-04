import type { RawStandardsFinding } from '@lightsout/standards-contracts';
import { bannedFolderNames } from '#common/constants/bannedFolderNames.ts';
import { buildRawFinding } from '#common/findings/buildRawFinding.ts';
import { getExportName } from '#common/naming/getExportName.ts';
import { getBaseName } from '#common/paths/getBaseName.ts';

interface Params {
	/** Every source file to judge: no tests, no index files. */
	files: string[];
	cap: number;
}

/** The part of a path from a `common/` down: the `common/` folder and what follows it. */
const splitAtCommon = ({ file }: { file: string }) => {
	const segments = file.split('/');

	return segments.flatMap((segment, index) =>
		segment === 'common' && index < segments.length - 1 ? [{ common: segments.slice(0, index + 1).join('/'), below: segments.slice(index + 1) }] : [],
	);
};

/**
 * A folder in a `common/` that holds 20 files or fewer, other than `types/`,
 * `constants/` and a module folder. A module folder counts once towards the
 * total, as the one function it is, and `types/` and `constants/` not at all,
 * since grouping by subject is for functions. A folder with a banned name is
 * the folder-name rule's to report, so it is left out here: one wrong folder
 * is one finding.
 */
export const findEarlyFolders = ({ files, cap }: Params): RawStandardsFinding[] => {
	const foldersByCommon = new Map<string, Map<string, string[]>>();
	const sizeByCommon = new Map<string, number>();

	for (const file of files) {
		for (const { common, below } of splitAtCommon({ file })) {
			const [child = '', ...rest] = below;
			const isMainFile = rest.length === 1 && getExportName({ path: file }) === child;

			if (rest.length === 0 || isMainFile) {
				sizeByCommon.set(common, (sizeByCommon.get(common) ?? 0) + 1);
			}

			if (rest.length > 0 && child !== 'types' && child !== 'constants' && !bannedFolderNames.has(child)) {
				const folders = foldersByCommon.get(common) ?? new Map<string, string[]>();

				foldersByCommon.set(common, folders.set(child, [...(folders.get(child) ?? []), file]));
			}
		}
	}

	return [...foldersByCommon].flatMap(([common, folders]) => {
		const subjectFolders = [...folders].filter(
			([name, paths]) => !paths.some((path) => path === `${common}/${name}/${getBaseName({ path })}` && getExportName({ path }) === name),
		);
		const size = (sizeByCommon.get(common) ?? 0) + subjectFolders.reduce((total, [, paths]) => total + paths.length, 0);

		return size > cap
			? []
			: subjectFolders.map(([name]) =>
					buildRawFinding({
						rule: 'common-folder-layout',
						files: [{ path: `${common}/${name}` }],
						detail: `folder '${name}' groups files in a common/ that holds ${size} (cap ${cap})`,
						guidance: 'Move its files directly into `common/`. A `common/` is grouped by subject only once it holds more files than the cap.',
					}),
				);
	});
};
