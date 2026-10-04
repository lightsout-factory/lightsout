import { resolve } from 'node:path';
import { defaultCoverageSummaryPath } from '#src/common/constants/defaultCoverageSummaryPath.ts';
import { defaultPackagesDir } from '#src/common/constants/defaultPackagesDir.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { CoverageScope } from '#src/coverage/internal/common/types/CoverageScope.ts';
import { resolveCoverageScopes } from '#src/coverage/resolveCoverageScopes.ts';

interface Params {
	cwd: string;
	config: LightsoutConfig;
}

/**
 * Shared because both selectors read these settings, and a copy drifting would
 * have them disagree about which scope owns a file.
 */
export const resolveScopeContext = async ({
	cwd,
	config,
}: Params): Promise<{ root: string; packagesDir: string; monorepo: boolean; scopes: CoverageScope[] }> => {
	const summaryPath = config['coverage-summary-path'] ?? defaultCoverageSummaryPath;

	return {
		root: resolve(cwd),
		packagesDir: config['packages-dir'] ?? defaultPackagesDir,
		monorepo: config['package-gates']?.['test-coverage'] !== undefined,
		scopes: await resolveCoverageScopes({ cwd, config, summaryPath }),
	};
};
