import { packageOf } from '#src/common/workspace/packageOf.ts';
import type { CoverageScope } from '#src/coverage/internal/common/types/CoverageScope.ts';

interface Params {
	/** Repo-relative file path. */
	file: string;
	scopes: CoverageScope[];
	packagesDir: string;
	/** True when a scoped coverage template is configured — packages are measured and root files are not; false when a single root command owns everything outside the packages dir. */
	monorepo: boolean;
}

export const coverageScopeOf = ({ file, scopes, packagesDir, monorepo }: Params): CoverageScope | undefined => {
	const packageDir = packageOf({ file, packagesDir });

	if (monorepo) {
		return packageDir === undefined ? undefined : scopes.find((entry) => entry.scope === packageDir);
	}

	return packageDir === undefined ? scopes[0] : undefined;
};
