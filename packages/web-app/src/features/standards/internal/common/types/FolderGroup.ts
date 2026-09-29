export interface FolderGroup {
	/** Repo-relative folder, cut to a readable depth — 'packages/engine/src/plan'. */
	folder: string;
	count: number;
	/** Rule ids contributing to this folder, most findings first. */
	rules: { rule: string; count: number }[];
}
