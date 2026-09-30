import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import type { ResolvedStandards } from '#src/standards/ResolvedStandards.ts';
import { resolveStandardsGroups } from '#src/standards/resolveStandardsGroups.ts';
import { buildStandardsDocuments } from '#src/standardsLibraries/buildStandardsDocuments.ts';

interface Params {
	cwd: string;
	config: LightsoutConfig | undefined;
	/** The command's package scope. Undefined = every workspace package. */
	packages?: string[];
}

/**
 * Assembled from the rule folders themselves, so no pre-built copy exists to
 * drift from its prose.
 *
 * @throws {Error} When a pack or library cannot be loaded, or a `standards-rule-settings` entry names no rule in the pack:
 * a repo that selected standards and did not get them must not run.
 */
export const resolveStandards = async ({ cwd, config, packages }: Params): Promise<ResolvedStandards> => {
	const groups = await resolveStandardsGroups({ cwd, config, packages });
	const { code, tests } = buildStandardsDocuments({ groups });

	return { standards: code, testStandards: tests, groups };
};
