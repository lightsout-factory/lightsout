interface Params {
	/** Repo-relative path — its extension is the whole answer. */
	path: string;
}

/** An allowlist, because every agent spawn costs a model call and an unknown file type should earn none. */
export const isTestableSourceFile = ({ path }: Params): boolean => /\.(m|c)?[jt]sx?$/i.test(path);
