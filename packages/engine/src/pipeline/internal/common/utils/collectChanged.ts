import { lstat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { defaultPackagesDir } from '#src/common/constants/defaultPackagesDir.ts';
import { readGitChangedFiles } from '#src/common/git/readGitChangedFiles.ts';
import { readGitWorkingChanges } from '#src/common/git/readGitWorkingChanges.ts';
import { packageOf } from '#src/common/workspace/packageOf.ts';
import type { WorkReport } from '#src/contracts/work/WorkReport.ts';
import { consumerRelative } from '#src/pipeline/internal/common/utils/consumerRelative.ts';
import type { PipelineRun } from '#src/pipeline/internal/PipelineRun.ts';

interface Params {
	run: PipelineRun;
	gitPrefix?: string;
	reports: WorkReport[];
}

/** The entry as a normalized cwd-relative path, or undefined when it lands outside the cwd or on the cwd itself. */
const toCwdRelative = ({ cwd, file }: { cwd: string; file: string }) => {
	const path = relative(cwd, resolve(cwd, file));
	const outside = path === '' || path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path);

	return outside ? undefined : path;
};

/**
 * The entry's cwd-relative path when it is a real path in the working tree:
 * one git's working changes list, removals included, or a regular file or
 * symbolic link on disk. A link is never followed — git tracks the link itself.
 */
const toRealPath = async ({ cwd, keepSet, file }: { cwd: string; keepSet: Set<string>; file: string }) => {
	const path = toCwdRelative({ cwd, file });

	if (path === undefined || keepSet.has(path)) {
		return path;
	}

	const stats = await lstat(resolve(cwd, path)).catch(() => undefined);

	return stats?.isFile() === true || stats?.isSymbolicLink() === true ? path : undefined;
};

/**
 * Agents can forget files; git cannot be sweet-talked. Package scope only
 * widens: declared scope is a starting point, and changed files are the truth.
 * An agent can also report an entry that is no file at all, such as a sentence,
 * so the whole list, carried-over entries included, keeps only real paths.
 */
export const collectChanged = async ({ run, gitPrefix, reports }: Params): Promise<{ changedFiles: string[]; packages: string[] }> => {
	// Generated/derived files (configured prefixes) are like gate artifacts:
	// real in the diff, but never attributed — their source is the change.
	const isGeneratedFile = ({ file }: { file: string }) => (run.config.generated ?? []).some((prefix) => file.startsWith(prefix));
	const packagesDir = run.config['packages-dir'] ?? defaultPackagesDir;
	const fromGit = ((await readGitChangedFiles({ cwd: run.cwd })) ?? []).filter(
		(file) => !run.current().baselineDirtyFiles.includes(file) && !isGeneratedFile({ file }),
	);
	const reported = reports
		.flatMap((report) => report.changedFiles.map((file) => file.path))
		.filter((path) => !isGeneratedFile({ file: consumerRelative({ gitPrefix, file: path }) }));
	// Git only decides what counts as real here; when it cannot read the tree, the disk alone decides.
	const keepSet = new Set(((await readGitWorkingChanges({ cwd: run.cwd })) ?? []).map((change) => change.path));
	const realPathsOf = ({ files }: { files: string[] }) => Promise.all(files.map((file) => toRealPath({ cwd: run.cwd, keepSet, file })));
	const carried = await realPathsOf({ files: run.current().changedFiles });
	const fromReports = await realPathsOf({ files: reported.map((path) => consumerRelative({ gitPrefix, file: path })) });
	const fromGitReal = await realPathsOf({ files: fromGit });
	const changedFiles = [...new Set([...carried, ...fromReports, ...fromGitReal].flatMap((file) => (file === undefined ? [] : [file])))];
	const dropped = [...new Set(reported.filter((_, index) => fromReports[index] === undefined))];

	if (dropped.length > 0) {
		run.progress(
			`warning unreal-reported-paths: ${run.current().currentStep ?? 'a step'} reported ${dropped.length} changed path(s) that are not files in the working tree, so they were left out: ${dropped.map((entry) => JSON.stringify(entry)).join(', ')}`,
		);
	}

	const fromFiles = changedFiles.flatMap((file) => {
		const packageDir = packageOf({ file, packagesDir });

		return packageDir ? [packageDir] : [];
	});

	return { changedFiles, packages: [...new Set([...run.current().packages, ...fromFiles])] };
};
