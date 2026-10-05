interface Params {
	/** The absolute path of the config the run loaded, or `undefined` when the checkout has none. */
	configPath: string | undefined;
}

/**
 * Every linked worktree carries its own copy of the tracked config, so a
 * setting edited in one checkout and a run launched from another looks like the
 * engine ignoring it; the path makes the mismatch visible.
 */
export const printConfigSource = ({ configPath }: Params): void => {
	console.log(`  config: ${configPath ?? 'none — this checkout has no lightsout.config.json, so every setting is its default'}`);
};
