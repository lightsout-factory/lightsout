interface Params {
	/** The absolute path of the config the run loaded, or `undefined` when neither the checkout nor its primary checkout has one. */
	configPath: string | undefined;
}

/**
 * A linked worktree without a config of its own reads the primary checkout's,
 * and a tracked config may differ between two checkouts, so a setting edited in
 * one place and a run launched from another can look like the engine ignoring
 * it; the path makes the mismatch visible.
 */
export const printConfigSource = ({ configPath }: Params): void => {
	console.log(
		`  config: ${configPath ?? 'none — neither this checkout nor its primary checkout has a lightsout.config.json, so every setting is its default'}`,
	);
};
