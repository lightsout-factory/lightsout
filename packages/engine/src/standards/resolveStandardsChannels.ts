import { defaultPackagesDir } from '#src/common/constants/defaultPackagesDir.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import { detectStandardsChannels } from '#src/standards/internal/detectStandardsChannels.ts';

interface Params {
	cwd: string;
	/** The consumer's config, absent on a repo that has none. */
	config: LightsoutConfig | undefined;
	/** Package scope whose dependencies decide the channels. Empty = the root package.json decides. */
	packages: string[];
}

// One rule for every caller: a run whose prose and checks disagreed about a
// repo's frameworks would be wrong in a way nothing reports.
export const resolveStandardsChannels = async ({ cwd, config, packages }: Params): Promise<string[]> =>
	config?.['standards-channels'] ?? detectStandardsChannels({ cwd, packagesDir: config?.['packages-dir'] ?? defaultPackagesDir, packages });
