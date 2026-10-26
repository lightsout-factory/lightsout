import { defaultSourceFileGlobs } from '#src/common/constants/defaultSourceFileGlobs.ts';
import { defaultTestFileGlobs } from '#src/common/constants/defaultTestFileGlobs.ts';
import type { RepoFileGlobs } from '#src/common/types/RepoFileGlobs.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';

interface Params {
	/** Absent where a command tolerates a repo with no config: the defaults apply then too. */
	config: LightsoutConfig | undefined;
}

/** The one reader of `source-files` and `test-files`, so every caller applies the same defaults. */
export const readRepoFileGlobs = ({ config }: Params): RepoFileGlobs => ({
	source: config?.['source-files'] ?? defaultSourceFileGlobs,
	tests: config?.['test-files'] ?? defaultTestFileGlobs,
});
