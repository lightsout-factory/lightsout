import { isIndexFile } from '#common/paths/isIndexFile.ts';
import { getFolderSegments } from './getFolderSegments.ts';
import { getLowestSharedFolder } from './getLowestSharedFolder.ts';
import { isMainFile } from './isMainFile.ts';
import { isUnder } from './isUnder.ts';
import type { PlacementVerdict } from './PlacementVerdict.ts';

interface Params {
	path: string;
	/** Every non-test file of the same package that imports it, at least one. */
	importers: string[];
	/** Every folder holding a main file, as a `/`-joined path. */
	moduleFolders: Set<string>;
	/** The `src/` of the package holding the file, with its trailing slash. */
	sourceRoot: string;
}

const describeFolder = ({ folder }: { folder: string }) => (folder === '' ? 'the repo root' : `'${folder}'`);

const quote = ({ paths }: { paths: string[] }) => paths.map((path) => `'${path}'`).join(', ');

/** The folder a module sits in: the one holding its file, or holding its folder when the file is that folder's main file. */
const getContainer = ({ path }: { path: string }) => {
	const segments = getFolderSegments({ path });

	return (isMainFile({ path }) ? segments.slice(0, -1) : segments).join('/');
};

const getSharedHomeGuidance = ({ home }: { home: string }) =>
	`Move it to the common/ of ${describeFolder({ folder: home })}, the lowest folder that holds every file using it, and update the imports.`;

/**
 * A module at the top level of a subject folder is public once anything
 * outside that folder uses it, a package's index file included. Nothing in a
 * module folder is public but its main file, and that sits in the folder above.
 */
const isPublic = ({ path, importers, moduleFolders }: Omit<Params, 'sourceRoot'>) => {
	const container = getContainer({ path });

	return !moduleFolders.has(container) && importers.some((importer) => isIndexFile({ path: importer }) || !isUnder({ path: importer, folder: container }));
};

/** Code one file uses sits beside that file, in the module folder the file is the main file of. */
const judgeSingleUser = ({ path, importer }: { path: string; importer: string }): PlacementVerdict | undefined =>
	isMainFile({ path: importer }) && getContainer({ path }) === getFolderSegments({ path: importer }).join('/')
		? undefined
		: {
				detail: `only '${importer}' uses it`,
				guidance: `Move it beside '${importer}', inside that file's module folder, and update the imports.`,
			};

/**
 * A file already in a `common/`: a user outside the folder the `common/` serves
 * means it sits too low, and every user under one child of that folder means it
 * sits too high. Users all inside the file's own `common/` are its peers.
 */
const judgeCommonFile = ({ path, importers }: { path: string; importers: string[] }): PlacementVerdict | undefined => {
	const segments = getFolderSegments({ path });
	const commonAt = segments.lastIndexOf('common');
	const served = segments.slice(0, commonAt).join('/');
	const commonFolder = segments.slice(0, commonAt + 1).join('/');
	const home = getLowestSharedFolder({ folders: importers.map((importer) => getFolderSegments({ path: importer })) });
	const outside = importers.filter((importer) => !isUnder({ path: importer, folder: served }));

	if (home === served || importers.every((importer) => isUnder({ path: importer, folder: commonFolder }))) {
		return undefined;
	}

	return {
		detail:
			outside.length > 0
				? `sits too low: ${quote({ paths: outside })} ${outside.length > 1 ? 'use' : 'uses'} it from outside ${describeFolder({ folder: served })}, and the lowest folder holding every user is ${describeFolder({ folder: home })}`
				: `sits too high: every user (${quote({ paths: importers })}) is under ${describeFolder({ folder: home })}`,
		guidance: getSharedHomeGuidance({ home }),
	};
};

/** A file outside every `common/` that two or more files use, none of which makes it public. */
const judgeSharedFile = ({ importers }: { importers: string[] }): PlacementVerdict => ({
	detail: `is shared by ${quote({ paths: importers })} and sits outside a common/`,
	guidance: getSharedHomeGuidance({ home: getLowestSharedFolder({ folders: importers.map((importer) => getFolderSegments({ path: importer })) }) }),
});

/**
 * Where a file belongs, from who uses it. Outside a `common/`, only a
 * package's source tree is judged, since the layout governs nothing else.
 */
export const judgePlacement = ({ path, importers, moduleFolders, sourceRoot }: Params): PlacementVerdict | undefined => {
	const isInCommon = getFolderSegments({ path }).includes('common');
	const [importer = '', ...otherImporters] = importers;

	if (!isInCommon && (!path.startsWith(sourceRoot) || isPublic({ path, importers, moduleFolders }))) {
		return undefined;
	}

	if (otherImporters.length === 0) {
		return judgeSingleUser({ path, importer });
	}

	return isInCommon ? judgeCommonFile({ path, importers }) : judgeSharedFile({ importers });
};
