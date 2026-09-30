import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

interface Params {
	/** Where to start walking up. Defaults to the directory of the running engine bundle. */
	startDir?: string;
}

/**
 * A development override, set by this repo's own suites: the walk below only
 * finds the built copy, so without it every test touching the default would
 * pass or fail on whether someone had run `pnpm bundle`.
 */
const overrideVariable = 'LIGHTSOUT_DEFAULT_STANDARDS';

/**
 * Walks up from the running program, accepting the installed layout
 * (`<plugin>/dist/` beside `<plugin>/standards/`) and this repo's dev layout
 * (`<repo>/plugin/standards/`). It never searches a repo's own folders: a
 * consumer that kept its house rules in a folder of the right name would have
 * them silently adopted as the engine's defaults.
 *
 * The engine is always invoked as `node <plugin>/dist/cli.mjs`, so
 * `process.argv[1]` is the bundle's own path.
 *
 * @throws {Error} When the override names a directory that is not a standards pack, or no bundled standards folder exists above the starting directory.
 */
export const resolveDefaultStandardsLibrary = ({ startDir }: Params = {}): string => {
	const override = process.env[overrideVariable];

	if (override !== undefined) {
		const overridden = resolve(override);

		// Thrown rather than fallen through to the walk: an override that silently
		// missed would look correct while checking the wrong rules.
		if (!existsSync(join(overridden, 'lightsout-standards.json'))) {
			throw new Error(`${overrideVariable} points at ${overridden}, which holds no lightsout-standards.json`);
		}

		return overridden;
	}

	const entryPoint = process.argv[1];
	let current = resolve(startDir ?? (entryPoint === undefined ? process.cwd() : dirname(entryPoint)));
	let found: string | undefined;

	while (found === undefined) {
		const candidates = [join(current, 'standards'), join(current, 'plugin', 'standards')];

		found = candidates.find((candidate) => existsSync(join(candidate, 'lightsout-standards.json')));

		const parent = dirname(current);

		if (found === undefined && parent === current) {
			throw new Error(`bundled default standards not found next to the engine (searched upward from ${current})`);
		}

		current = parent;
	}

	return found;
};
