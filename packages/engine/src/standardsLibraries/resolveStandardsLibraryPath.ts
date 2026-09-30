import { existsSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { standardsLibraryRootFile } from '#src/common/constants/standardsLibraryRootFile.ts';
import { builtInStandardsLibraryName } from '#src/contracts/standards/builtInStandardsLibraryName.ts';

interface Params {
	/** The repo root the entry is read against. */
	cwd: string;
	/** The entry's key: the library name. */
	name: string;
	/** The entry's value: a repo folder or an npm package name. */
	value: string;
}

/**
 * Looked up the way Node looks up a package — `node_modules/<name>` in `cwd`,
 * then in each parent — rather than through `require.resolve`, which a
 * package's `exports` map can stop from reaching lightsout-standards.json.
 * The folder found is replaced by its real path, so a workspace-linked library
 * loads from its source.
 */
const findInstalledPackage = ({ cwd, packageName }: { cwd: string; packageName: string }) => {
	let current = resolve(cwd);
	let found: string | undefined;
	let searched = false;

	while (found === undefined && !searched) {
		const candidate = join(current, 'node_modules', packageName);
		const parent = dirname(current);

		if (existsSync(candidate)) {
			found = realpathSync(candidate);
		}

		searched = parent === current;
		current = parent;
	}

	return found;
};

/**
 * A value is read the way Node reads a specifier: `./`, `../` or an absolute
 * path is a folder resolved against `cwd`, and anything else is a package
 * name. Reads no manifest — whether the library's name matches its key needs
 * the loaded library, so `resolveStandardsLibraries` checks that.
 *
 * @throws {Error} When the key is lightsout or not one path segment, or the value names no folder holding lightsout-standards.json. Every message names the key and the value.
 */
export const resolveStandardsLibraryPath = ({ cwd, name, value }: Params): string => {
	const entry = `standards-libraries entry "${name}": "${value}"`;

	if (name === builtInStandardsLibraryName) {
		throw new Error(`${entry} — the name ${builtInStandardsLibraryName} is reserved for the built-in library`);
	}

	// A rule's full name is `<library>/<rule-id>`, so a slash in a library name would make it ambiguous.
	if (name.includes('/')) {
		throw new Error(`${entry} — a library name must be one path segment, with no "/"`);
	}

	const isFolder = value.startsWith('./') || value.startsWith('../') || isAbsolute(value);
	const libraryPath = isFolder ? resolve(cwd, value) : findInstalledPackage({ cwd, packageName: value });

	if (libraryPath === undefined) {
		throw new Error(`${entry} — no node_modules/${value} was found in ${resolve(cwd)} or any folder above it`);
	}

	if (!existsSync(join(libraryPath, standardsLibraryRootFile))) {
		throw new Error(`${entry} — ${libraryPath} holds no ${standardsLibraryRootFile}`);
	}

	return libraryPath;
};
