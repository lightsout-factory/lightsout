import { join } from 'node:path';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { coverageScopeOf } from '#src/coverage/common/coverageScopeOf.ts';
import { loadScopeJestConfig } from '#src/coverage/common/loadScopeJestConfig.ts';
import { resolveScopeContext } from '#src/coverage/common/resolveScopeContext.ts';
import { scopeRootOf } from '#src/coverage/common/scopeRootOf.ts';
import type { CoverageCollection } from '#src/coverage/selectCollectedFiles/common/types/CoverageCollection.ts';
import { isCoverageCollectedFile } from '#src/coverage/selectCollectedFiles/isCoverageCollectedFile/isCoverageCollectedFile.ts';
import { readCoverageCollection } from '#src/coverage/selectCollectedFiles/readCoverageCollection.ts';

interface Params {
	cwd: string;
	config: LightsoutConfig;
	/** Repo-relative candidate files to split. */
	files: string[];
}

/**
 * The gate and the write-tests target selection both ask this, and two copies
 * are how a writer gets asked for a test the gate would then exempt.
 *
 * A file no scope measures counts as collected: that is the caller's own
 * question to answer.
 */
export const selectCollectedFiles = async ({ cwd, config, files }: Params): Promise<{ collected: string[]; excluded: string[] }> => {
	const { root, packagesDir, monorepo, scopes } = await resolveScopeContext({ cwd, config });
	const collections = new Map<string, CoverageCollection | undefined>();
	const collected: string[] = [];
	const excluded: string[] = [];

	for (const file of files) {
		const scope = coverageScopeOf({ file, scopes, packagesDir, monorepo });

		if (scope === undefined) {
			collected.push(file);
			continue;
		}

		if (!collections.has(scope.scope)) {
			const scopeRoot = scopeRootOf({ root, scope: scope.scope, packagesDir, monorepo });

			collections.set(scope.scope, readCoverageCollection({ loaded: await loadScopeJestConfig({ scopeRoot, command: scope.command }) }));
		}

		const collection = collections.get(scope.scope);

		(isCoverageCollectedFile({ absolutePath: join(root, file), collection }) ? collected : excluded).push(file);
	}

	return { collected, excluded };
};
