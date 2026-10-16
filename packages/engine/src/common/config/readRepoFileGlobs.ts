import type { RepoFileGlobs } from '#src/common/types/RepoFileGlobs.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';

interface Params {
	/** Absent where a command tolerates a repo with no config: then no file is code, and none is a test. */
	config: LightsoutConfig | undefined;
}

export const readRepoFileGlobs = ({ config }: Params): RepoFileGlobs => ({ source: config?.['source-files'] ?? [], tests: config?.['test-files'] ?? [] });
