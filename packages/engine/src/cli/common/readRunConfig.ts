import type { ZodError } from 'zod';
import { describeConfigIssues } from '#src/common/config/describeConfigIssues.ts';
import { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';

interface Params {
	/** The run whose recorded config is being used — already read with readRunManifest. */
	manifest: RunManifest;
}

const describeRejection = ({ manifest, error }: { manifest: RunManifest; error: ZodError }) => {
	const recordedAt = manifest.configPath === undefined ? '' : ` (read from ${manifest.configPath})`;

	return [
		`run ${manifest.runId} recorded a configuration${recordedAt} that this engine does not accept:`,
		...describeConfigIssues({ error }),
		'start a new run',
	].join('\n');
};

/**
 * The config a run started with, for every step that continues it. Reads no
 * file: a refusal is answered rather than thrown, and never falls back to
 * lightsout.config.json, which would hold the run to a second configuration.
 */
export const readRunConfig = ({ manifest }: Params): { config: LightsoutConfig } | { error: string } => {
	if (manifest.config === undefined) {
		return {
			error: `run ${manifest.runId} recorded no configuration, so it cannot continue on the configuration it started with — start a new run`,
		};
	}

	const parsed = LightsoutConfig.safeParse(manifest.config);

	return parsed.success ? { config: parsed.data } : { error: describeRejection({ manifest, error: parsed.error }) };
};
