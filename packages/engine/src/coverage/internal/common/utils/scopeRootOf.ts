import { join } from 'node:path';

interface Params {
	/** Absolute repo root. */
	root: string;
	scope: string;
	packagesDir: string;
	/** True when a scoped coverage template is configured — each package is its own scope with its own root; false when a single root command owns everything. */
	monorepo: boolean;
}

/** Shared so two readers of a scope's configuration never read different files for the same scope. */
export const scopeRootOf = ({ root, scope, packagesDir, monorepo }: Params): string => (monorepo ? join(root, packagesDir, scope) : root);
