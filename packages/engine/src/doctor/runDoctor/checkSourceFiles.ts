import { readRepoFileGlobs } from '#src/common/config/readRepoFileGlobs.ts';
import { excludedSourcePaths } from '#src/common/sourceFiles/excludedSourcePaths.ts';
import { isTestFile } from '#src/common/sourceFiles/isTestFile.ts';
import { listSourceFiles } from '#src/common/sourceFiles/listSourceFiles.ts';
import { matchesGlobs } from '#src/common/sourceFiles/matchesGlobs.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { DoctorCheck } from '#src/doctor/runDoctor/common/types/DoctorCheck.ts';

interface Params {
	cwd: string;
	config: LightsoutConfig;
}

/**
 * A glob that matches nothing is almost always a typo, and a `source-files`
 * list that matches nothing leaves every check, writer and count with no file
 * to read — silently, as an empty run rather than an error.
 */
export const checkSourceFiles = async ({ cwd, config }: Params): Promise<DoctorCheck> => {
	const sourceFileGlobs = readRepoFileGlobs({ config }).source;
	const { files } = await listSourceFiles({ cwd, sourceFileGlobs, exclude: excludedSourcePaths({ config }) });
	const tests = files.filter((path) => isTestFile({ path, testFileGlobs: readRepoFileGlobs({ config }).tests }));
	// One list per glob, built once, so each glob is compiled once rather than once per file.
	const included = sourceFileGlobs.filter((glob) => !glob.startsWith('!')).map((glob) => [glob]);
	const unmatched = included.filter((globs) => !files.some((path) => matchesGlobs({ path, globs }))).map(([glob]) => glob);

	if (files.length === 0) {
		return {
			id: 'source-files',
			status: 'warn',
			detail: 'source-files matches no file in this repo, so no check, test writer or plan count has anything to read',
			fix: 'list the globs of your code files, tests included, e.g. "source-files": ["src/**/*.{ts,tsx}"]',
		};
	}

	return unmatched.length === 0
		? { id: 'source-files', status: 'pass', detail: `${files.length} code file(s), ${tests.length} of them tests` }
		: {
				id: 'source-files',
				status: 'note',
				detail: `${files.length} code file(s), ${tests.length} of them tests; ${unmatched.map((glob) => `"${glob}"`).join(', ')} match(es) no file`,
				fix: 'a glob that matches nothing is usually a typo — correct it or remove it from source-files',
			};
};
