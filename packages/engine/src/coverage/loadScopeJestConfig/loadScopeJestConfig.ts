import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { z } from 'zod';
import { extractRunScriptName } from '#src/common/config/extractRunScriptName.ts';
import type { LoadedJestConfig } from '#src/coverage/internal/common/types/LoadedJestConfig.ts';
import { resolveJestConfigPath } from '#src/coverage/loadScopeJestConfig/internal/common/utils/resolveJestConfigPath.ts';

const ScopeManifest = z.looseObject({ scripts: z.record(z.string(), z.string()).optional().catch(undefined) });

// A script's body, not the runner invocation that names it, names the Jest
// config. `readPackageManifest` is not used because it throws on a manifest with
// no `name`, where here an unreadable manifest means "nothing is known".
const resolveScopeCoverageScript = async ({ scopeRoot, command }: { scopeRoot: string; command: string }) => {
	const scriptName = extractRunScriptName({ command });

	if (scriptName === undefined) {
		return command;
	}

	try {
		const parsed = ScopeManifest.safeParse(JSON.parse(await readFile(join(scopeRoot, 'package.json'), 'utf8')));

		return parsed.success ? parsed.data.scripts?.[scriptName] : undefined;
	} catch {
		return undefined;
	}
};

const requireConfig = ({ configPath }: { configPath: string }) => {
	try {
		// A dynamic require is typed `any`; the annotation is what states that
		// nothing is yet known about the shape.
		const loaded: unknown = createRequire(configPath)(configPath);

		return loaded;
	} catch {
		return undefined;
	}
};

const readJestKey = ({ loaded }: { loaded: unknown }) => (typeof loaded === 'object' && loaded !== null && 'jest' in loaded ? loaded.jest : undefined);

// Jest permits an async config factory, which this loader deliberately does
// not run — a subprocess-free read never executes the consumer's own code.
const isThenable = ({ value }: { value: object }) => 'then' in value && typeof value.then === 'function';

interface Params {
	/** Absolute path to the scope's root directory (the repo root, or `<packagesDir>/<scope>`). */
	scopeRoot: string;
	/** The scope's coverage gate command as configured, before any `… run <script>` indirection is resolved. */
	command: string;
}

/**
 * Undefined when no config can be `require`d (TypeScript, ESM-only, a function
 * or promise export) or the runner is not Jest. Every view over a scope's
 * configuration reads through this one loader, so no two views disagree about
 * which config file a scope uses.
 */
export const loadScopeJestConfig = async ({ scopeRoot, command }: Params): Promise<LoadedJestConfig | undefined> => {
	const coverageScript = await resolveScopeCoverageScript({ scopeRoot, command });
	const configPath = await resolveJestConfigPath({ scopeRoot, coverageScript });

	if (configPath === undefined) {
		return undefined;
	}

	const loaded = requireConfig({ configPath });
	const value = configPath.endsWith('package.json') ? readJestKey({ loaded }) : loaded;

	if (typeof value !== 'object' || value === null || isThenable({ value })) {
		return undefined;
	}

	return { configPath, config: value };
};
