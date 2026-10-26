import { matchesGlobs } from '#src/common/sourceFiles/matchesGlobs.ts';
import type { ResolvedRuleState } from '#src/common/types/ResolvedRuleState.ts';
import type { StandardsGroup } from '#src/common/types/StandardsGroup.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { findWorkspacePackage } from '#src/standardsCheck/common/findWorkspacePackage.ts';

interface Params {
	/** Findings already graded: each carries its full rule name. */
	findings: StandardsFinding[];
	/** The group grading a finding, found by the finding's first file — the same lookup the caller graded with. */
	groupOfFile: (file: string | undefined) => StandardsGroup | undefined;
	/** Monorepo package parent dir (config['packages-dir'] ?? defaultPackagesDir). */
	packagesDir: string;
	/** The folder names `listWorkspacePackages` returns, listed once by the caller. */
	workspacePackages: string[];
}

/** The path inside the file's workspace package — empty for the package folder itself — or the repo-relative path outside every package. */
const packageRelativePath = ({ file, packagesDir, workspacePackages }: { file: string; packagesDir: string; workspacePackages: string[] }) => {
	const name = findWorkspacePackage({ file, packagesDir, workspacePackages });

	if (name === undefined) {
		return file;
	}

	const root = `${packagesDir}/${name}`;

	return file === root ? '' : file.slice(root.length + 1);
};

/** The state's own arrays reach `matchesGlobs`, never a copy, so each list is compiled once rather than once per file. */
const isExcluded = ({
	file,
	state,
	packagesDir,
	workspacePackages,
}: {
	file: string;
	state: ResolvedRuleState;
	packagesDir: string;
	workspacePackages: string[];
}) =>
	matchesGlobs({ path: packageRelativePath({ file, packagesDir, workspacePackages }), globs: state.packExclude }) ||
	matchesGlobs({ path: file, globs: state.repoExclude });

/**
 * Drops a finding whose every file the rule excludes, as the group grading it
 * runs the rule: a pack's globs read each file's path inside its own workspace
 * package, a repo's the repo-relative path. A finding naming no file, or whose
 * group does not hold its rule, stays. Every drop is counted, one note per
 * rule — a silent drop would read as a clean check.
 */
export const dropExcludedFindings = ({ findings, groupOfFile, packagesDir, workspacePackages }: Params): { findings: StandardsFinding[]; notes: string[] } => {
	const kept: StandardsFinding[] = [];
	const dropped = new Map<string, number>();

	for (const finding of findings) {
		const state = groupOfFile(finding.files[0]?.path)?.states.get(finding.rule);
		const excluded =
			state !== undefined && finding.files.length > 0 && finding.files.every((file) => isExcluded({ file: file.path, state, packagesDir, workspacePackages }));

		if (excluded) {
			dropped.set(finding.rule, (dropped.get(finding.rule) ?? 0) + 1);
		} else {
			kept.push(finding);
		}
	}

	const rules = [...dropped.keys()].sort();
	const notes = rules.map((rule) => `${dropped.get(rule)} finding(s) of ${rule} dropped — every file they name matches the rule's exclude list`);

	return { findings: kept, notes };
};
