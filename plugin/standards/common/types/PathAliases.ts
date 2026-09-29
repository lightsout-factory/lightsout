/**
 * `base` is where the targets are anchored: the manifest's own folder for the
 * `imports` form, and for a tsconfig its `baseUrl` when the file declares one,
 * else the config's own folder, which is what TypeScript does.
 */
export interface PathAliases {
	base: string;
	/** Alias pattern (`#src/*`, `@/*`) to the target patterns it maps to (`./src/*`), in declaration order. */
	patterns: Map<string, string[]>;
}
