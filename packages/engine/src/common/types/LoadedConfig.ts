import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';

/**
 * The config a run started with, exactly as `readConfig` returned it, before
 * any command stamped its harness, model or effort on it, together with the
 * file it was read from. A run records this, never the stamped config, so a
 * resume re-derives effective values exactly as a fresh run did.
 */
export interface LoadedConfig {
	config: LightsoutConfig;
	/** Absolute path of the lightsout.config.json the config was read from. Absent only on a resume of a manifest that predates the record. */
	path?: string;
}
