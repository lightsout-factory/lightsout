import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type ts from 'typescript';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { coverageScopeOf } from '#src/coverage/common/coverageScopeOf.ts';
import { loadScopeJestConfig } from '#src/coverage/common/loadScopeJestConfig/loadScopeJestConfig.ts';
import { resolveScopeContext } from '#src/coverage/common/resolveScopeContext.ts';
import { scopeRootOf } from '#src/coverage/common/scopeRootOf.ts';
import type { JestModuleMode } from '#src/coverage/selectUnloadableFiles/common/types/JestModuleMode.ts';
import { isEsmSourceFile } from '#src/coverage/selectUnloadableFiles/isEsmSourceFile.ts';
import { isUnloadableSourceFile } from '#src/coverage/selectUnloadableFiles/isUnloadableSourceFile.ts';
import { readJestModuleMode } from '#src/coverage/selectUnloadableFiles/readJestModuleMode.ts';
import { readNearestPackageType } from '#src/coverage/selectUnloadableFiles/readNearestPackageType.ts';

interface Params {
	cwd: string;
	config: LightsoutConfig;
	/** Repo-relative candidate files to split. */
	files: string[];
	/** The consumer's TypeScript module, or undefined — without one nothing is classified unloadable. */
	compiler: typeof ts | undefined;
}

/**
 * A file holding an `await` at module scope is unloadable exactly when its
 * scope's Jest loads it as CommonJS, where that `await` is a syntax error.
 *
 * One function answers this for every caller on purpose: the execution gate and
 * the write-tests target selection must agree, or a writer gets asked for a test
 * the gate would then exempt. That is also why each file's content is read here
 * rather than taken from the caller.
 *
 * Every uncertain answer keeps the file unloadable: a wrong ESM verdict fails a
 * run on a file no test could ever cover, while a wrong CommonJS verdict merely
 * skips it.
 */
export const selectUnloadableFiles = async ({ cwd, config, files, compiler }: Params): Promise<{ loadable: string[]; unloadable: string[] }> => {
	if (compiler === undefined) {
		return { loadable: files, unloadable: [] };
	}

	const { root, packagesDir, monorepo, scopes } = await resolveScopeContext({ cwd, config });
	// Two maps rather than one composite key: the Jest configuration load is the
	// expensive half and is genuinely per scope, while the manifest walk is cheap
	// and genuinely per directory.
	const modes = new Map<string, JestModuleMode | undefined>();
	const packageTypes = new Map<string, string | undefined>();
	const loadable: string[] = [];
	const unloadable: string[] = [];

	for (const file of files) {
		const content = await readFile(join(cwd, file), 'utf8').catch(() => undefined);

		if (content === undefined || !isUnloadableSourceFile({ path: file, content, compiler })) {
			// An unreadable file keeps the caller's own handling of it, and a file
			// with no module-scope `await` loads under either module system.
			loadable.push(file);
			continue;
		}

		const scope = coverageScopeOf({ file, scopes, packagesDir, monorepo });

		if (scope === undefined) {
			// No Jest configuration governs this file, so its module mode is
			// undetermined, which keeps the exemption.
			unloadable.push(file);
			continue;
		}

		const scopeRoot = scopeRootOf({ root, scope: scope.scope, packagesDir, monorepo });

		if (!modes.has(scope.scope)) {
			modes.set(scope.scope, readJestModuleMode({ loaded: await loadScopeJestConfig({ scopeRoot, command: scope.command }) }));
		}

		const fileDir = dirname(join(root, file));

		if (!packageTypes.has(fileDir)) {
			packageTypes.set(fileDir, await readNearestPackageType({ fileDir, scopeRoot }));
		}

		const esm = isEsmSourceFile({ path: file, moduleMode: modes.get(scope.scope), packageType: packageTypes.get(fileDir) });

		(esm ? loadable : unloadable).push(file);
	}

	return { loadable, unloadable };
};
