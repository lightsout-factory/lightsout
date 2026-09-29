import { isSnapshotFile } from '#src/common/sourceFiles/isSnapshotFile.ts';
import { isTestFile } from '#src/common/sourceFiles/isTestFile.ts';

/**
 * A jest config file — what decides which tests are collected at all. The same
 * expression `findJestConfigs` applies, so the doctor and the reviewer agree
 * about which files those are.
 */
const jestConfigFileName = /^jest(\..+)?\.config\.(js|cjs|mjs|ts)$/;

interface Params {
	/** A repo-relative path. */
	path: string;
	/** Repo-relative roots of the standards packs in the tree, passed straight through to `isTestFile`. */
	standardsPacks?: string[];
}

/**
 * `isTestFile` plus the two file kinds that decide a test's verdict without an
 * assertion in code: a snapshot is the expected value, and a jest config
 * decides which tests are collected at all.
 */
export const isTestSideFile = ({ path, standardsPacks }: Params): boolean => {
	const name = path.slice(path.lastIndexOf('/') + 1);

	return isTestFile({ path, standardsPacks }) || isSnapshotFile({ path }) || jestConfigFileName.test(name);
};
