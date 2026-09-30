import type { RefactorBatch } from '#src/contracts/refactor/RefactorBatch.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';

/**
 * Mechanical fixes come before judgment-heavier duplication work, so a run's
 * early batches are its safest. The list names the built-in library's rules by
 * full name; every other rule sorts last rather than erroring.
 *
 * The names are written out rather than read from libraries: batching order is
 * engine pacing policy, not a fact a library should have to restate.
 */
const rulePriority: string[] = [
	'lightsout/banned-folder-name',
	'lightsout/file-directly-in-common',
	'lightsout/folder-index-file',
	'lightsout/test-in-tests-folder',
	'lightsout/test-not-beside-subject',
	'lightsout/test-support-in-src',
	'lightsout/import-through-index',
	'lightsout/internal-import-from-outside',
	'lightsout/multi-export',
	'lightsout/filename-mismatch',
	'lightsout/test-mock-prefix',
	'lightsout/test-mock-return-in-hook',
	'lightsout/test-mock-untyped',
	'lightsout/test-mock-wrapper-untyped',
	'lightsout/test-shared-let',
	'lightsout/test-assert-in-hook',
	'lightsout/test-nested-describe',
	'lightsout/test-manual-mock-cleanup',
	'lightsout/test-strict-equal-matcher',
	'lightsout/barrel-star',
	'lightsout/dead-export',
	'lightsout/test-only-export',
	'lightsout/file-size',
	'lightsout/function-size',
	'lightsout/ungrouped-domain-utils',
	'lightsout/single-file-domain-folder',
	'lightsout/folder-casing',
	'lightsout/test-multiple-setups',
	'lightsout/oversized-setup-factory',
	'lightsout/folder-size',
	'lightsout/duplicate-function-body',
	'lightsout/duplicate-code-block',
	'lightsout/duplicate-export-name',
	'lightsout/synonym-export-name',
];

/** Keeps one agent job readable. */
const maxBatchFindings = 12;

const priorityOf = ({ rule }: { rule: string }) => {
	const index = rulePriority.indexOf(rule);

	return index === -1 ? rulePriority.length : index;
};

interface Params {
	/** Blocking-severity check results — the work. */
	blocking: StandardsFinding[];
	/** Attached to batches whose files overlap, never work on their own. */
	advisories: StandardsFinding[];
	/** Monorepo package parent dir, for the grouping folder. */
	packagesDir: string;
}

/** One batch is one rule in one area of the repo, so each is a single coherent agent job. */
export const batchFindings = ({ blocking, advisories, packagesDir }: Params): RefactorBatch[] => {
	const areaOf = ({ path }: { path: string }) => {
		const segments = path.split('/');

		if (segments[0] === packagesDir && segments.length > 2 && segments[1]) {
			return `${packagesDir}/${segments[1]}`;
		}

		return segments.length > 1 && segments[0] ? segments[0] : '(root)';
	};

	// A finding spanning areas cannot be resolved by an agent scoped to one side,
	// so it gets a cross batch covering every side.
	const folderOf = ({ finding }: { finding: StandardsFinding }) => {
		const areas = new Set(finding.files.map((file) => areaOf({ path: file.path })));

		return areas.size > 1 ? '(cross)' : ([...areas][0] ?? '(root)');
	};

	const groups = new Map<string, { rule: string; folder: string; findings: StandardsFinding[] }>();

	for (const finding of blocking) {
		const folder = folderOf({ finding });
		const key = `${finding.rule}\0${folder}`;
		const group = groups.get(key) ?? { rule: finding.rule, folder, findings: [] };

		group.findings.push(finding);
		groups.set(key, group);
	}

	const crossLast = ({ folder }: { folder: string }) => (folder === '(cross)' ? 1 : 0);
	const ordered = [...groups.values()].sort(
		(a, b) =>
			priorityOf({ rule: a.rule }) - priorityOf({ rule: b.rule }) ||
			a.rule.localeCompare(b.rule) ||
			crossLast({ folder: a.folder }) - crossLast({ folder: b.folder }) ||
			a.folder.localeCompare(b.folder),
	);

	const batches: RefactorBatch[] = [];

	for (const group of ordered) {
		const sorted = [...group.findings].sort((a, b) => a.siteKey.localeCompare(b.siteKey));

		for (let start = 0; start < sorted.length; start += maxBatchFindings) {
			const chunk = sorted.slice(start, start + maxBatchFindings);
			const chunkFiles = new Set(chunk.flatMap((finding) => finding.files.map((file) => file.path)));
			const number = String(batches.length + 1).padStart(2, '0');

			batches.push({
				id: `batch-${number}:${group.rule}:${group.folder}`,
				rule: group.rule,
				folder: group.folder,
				blocking: chunk,
				advisories: advisories.filter((advisory) => advisory.files.some((file) => chunkFiles.has(file.path))),
			});
		}
	}

	return batches;
};
