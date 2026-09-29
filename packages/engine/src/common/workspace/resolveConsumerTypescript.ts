import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import type ts from 'typescript';

interface Params {
	cwd: string;
	/** Monorepo package parent dir (default 'packages') — pnpm workspaces keep typescript in package node_modules, not the root. */
	packagesDir?: string;
}

/**
 * Borrows the consumer's compiler rather than bundling one every TS consumer
 * already has, and answers undefined in a JS-only repo. Workspace packages are
 * tried after the root because pnpm hoists nothing by default.
 */
export const resolveConsumerTypescript = ({ cwd, packagesDir = 'packages' }: Params): typeof ts | undefined => {
	// createRequire rejects relative paths, so anchor first.
	const root = resolve(cwd);

	let packageNames: string[] = [];

	try {
		packageNames = readdirSync(join(root, packagesDir)).filter((name) => !name.startsWith('.'));
	} catch {
		// not a monorepo — root-only resolution below
	}

	const manifests = [join(root, 'package.json'), ...packageNames.map((name) => join(root, packagesDir, name, 'package.json'))];

	for (const manifest of manifests) {
		try {
			// A dynamic require is typed `any`; the module either resolves as the
			// compiler or throws, so there is no runtime shape to narrow on.
			const compiler: typeof ts = createRequire(manifest)('typescript');

			return compiler;
		} catch {}
	}

	return undefined;
};
