import { join } from 'node:path';
import { defaultPackagesDir } from '#src/common/constants/defaultPackagesDir.ts';
import { listWorkspacePackages } from '#src/common/workspace/listWorkspacePackages.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import { StandardsPackSource } from '#src/contracts/standards/StandardsPackSource.ts';
import type { StandardsGroup } from '#src/standards/common/types/StandardsGroup.ts';
import { detectStandardsPack } from '#src/standards/detectStandardsPack.ts';
import { resolveRuleStates } from '#src/standards/internal/resolveRuleStates.ts';
import { resolveStandardsLibraries } from '#src/standardsLibraries/resolveStandardsLibraries.ts';
import { resolveStandardsPack } from '#src/standardsLibraries/resolveStandardsPack.ts';

interface Params {
	cwd: string;
	/** The repo's config, absent on a repo that has none. */
	config: LightsoutConfig | undefined;
	/** The command's package scope (folder names under packages-dir). Undefined = every workspace package. */
	packages?: string[];
}

/**
 * The one place a command learns which standards apply: every caller asks
 * here, so a run's prose, checks and review can never disagree about the pack.
 * The repo's `standards-rule-settings` are applied last, over the pack.
 *
 * @throws {Error} When a library or the pack cannot be loaded, or a `standards-rule-settings` entry names no rule in the pack.
 */
export const resolveStandardsGroups = async ({ cwd, config, packages }: Params): Promise<StandardsGroup[]> => {
	const named = config?.['standards-pack'];

	if (named === false) {
		return [];
	}

	const address = named ?? (await detectStandardsPack({ manifestPath: join(cwd, 'package.json') }));
	const scope = packages ?? (await listWorkspacePackages({ cwd, packagesDir: config?.['packages-dir'] ?? defaultPackagesDir }));
	const libraries = await resolveStandardsLibraries({ cwd, config });
	const pack = resolveStandardsPack({ address, libraries });
	const source = named === undefined ? StandardsPackSource.Detected : StandardsPackSource.Named;
	const covered = ['', ...[...new Set(scope)].sort()];

	const statesPerPack = resolveRuleStates({ packs: [pack], ruleSettings: config?.['standards-rule-settings'] });

	return statesPerPack.map((states) => ({ packages: covered, pack, source, states }));
};
