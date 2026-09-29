import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';

interface Params {
	findings: StandardsFinding[];
	/** Repo-relative files this run changed. */
	changedFiles: string[];
}

/**
 * Severity is the only gate lever. There is no allow-list of blockable rules:
 * one that is off by default and needs remembering to switch on never gets
 * switched on, so a repo that wants a rule to stop blocking says so in its
 * committed `standards-checks` config instead.
 */
export const selectStandardsFindings = ({ findings, changedFiles }: Params): { workList: StandardsFinding[]; advisories: StandardsFinding[] } => {
	const changed = new Set(changedFiles);

	// Some rules site a folder rather than a file, so a folder counts as changed
	// when the run changed a file under it. The `/` makes this containment rather
	// than string prefixing, so `src/app` never claims a change inside `src/appUI`.
	const isChanged = (path: string) => changed.has(path) || changedFiles.some((file) => file.startsWith(`${path}/`));
	const touchesChanged = (finding: StandardsFinding) => finding.files.some((file) => isChanged(file.path));

	return {
		workList: findings.filter((finding) => finding.severity === StandardsSeverity.Blocking && touchesChanged(finding)),
		advisories: findings.filter((finding) => finding.severity === StandardsSeverity.Advisory && touchesChanged(finding)),
	};
};
