interface ConstructorParams {
	/** Absolute path the config was looked for at. */
	configPath: string;
}

/**
 * Distinct from a config that will not parse, whose message reaches the error
 * boundary as itself: a missing file is a 404.
 */
export class ConfigNotFoundError extends Error {
	constructor({ configPath }: ConstructorParams) {
		super(`no lightsout.config.json at ${configPath}`);
		this.name = 'ConfigNotFoundError';
	}
}
