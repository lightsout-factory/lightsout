/** One `common/` folder an agent can reach from where it works, with what the folder holds. */
export interface SharedCodeFolder {
	/** Repo-relative path of the `common/` folder itself. */
	path: string;
	/** Its files by the folder each sits in, relative to `path`; the empty string for a file directly in it. */
	groups: { folder: string; names: string[] }[];
}
