import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { standardsLibraryRootFile } from '#src/common/constants/standardsLibraryRootFile.ts';
import { readGitFileList } from '#src/common/git/readGitFileList.ts';
import { resolveDefaultStandardsLibrary } from '#src/standardsLibraries/resolveDefaultStandardsLibrary.ts';

interface Params {
	cwd: string;
}

const readLibraryName = ({ folder }: { folder: string }): string | undefined => {
	try {
		const parsed: unknown = JSON.parse(readFileSync(join(folder, standardsLibraryRootFile), 'utf8'));

		return typeof parsed === 'object' && parsed !== null && 'name' in parsed && typeof parsed.name === 'string' ? parsed.name : undefined;
	} catch {
		return undefined;
	}
};

const readShippedName = (): string | undefined => {
	try {
		return readLibraryName({ folder: resolveDefaultStandardsLibrary() });
	} catch {
		return undefined;
	}
};

/**
 * `resolveDefaultStandardsLibrary` deliberately finds the shipped copy, which
 * carries no fixture pairs; a pack page has to show the examples a rule argues
 * from, so it looks for the authored folder, which still has its fixtures.
 * That is a folder in the repo whose manifest carries the shipped library's
 * own name, wherever it sits: a repo's own library under any other name is
 * never mistaken for the built-in one.
 *
 * @returns the absolute folder, or `undefined` when the caller should fall back to the shipped copy
 */
export const resolveAuthoredStandardsLibrary = async ({ cwd }: Params): Promise<string | undefined> => {
	// The same override `resolveDefaultStandardsLibrary` honours, so a repo's own
	// suites and dev server agree with the engine about which library is the default.
	const override = process.env.LIGHTSOUT_DEFAULT_STANDARDS;

	if (override !== undefined && existsSync(join(resolve(override), standardsLibraryRootFile))) {
		return resolve(override);
	}

	const shippedName = readShippedName();

	if (shippedName === undefined) {
		return undefined;
	}

	// Outside git there is no listing to search, so only the repo itself can be the library.
	const listed = (await readGitFileList({ cwd })) ?? [standardsLibraryRootFile];
	const folders = listed.filter((file) => basename(file) === standardsLibraryRootFile).map((file) => resolve(cwd, dirname(file)));

	return folders.find((folder) => readLibraryName({ folder }) === shippedName);
};
