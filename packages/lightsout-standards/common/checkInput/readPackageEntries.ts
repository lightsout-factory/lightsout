import { getDirectory } from '../paths/getDirectory.ts';
import { joinPath } from '../paths/joinPath.ts';
import type { PackageEntries } from '../types/PackageEntries.ts';
import { isRecord } from '../utils/isRecord.ts';

const entryFields = ['main', 'module', 'types', 'typings', 'exports'];

const collectTargets = ({ value }: { value: unknown }): string[] => {
	if (typeof value === 'string') {
		return [value];
	}

	if (Array.isArray(value)) {
		return value.flatMap((item) => collectTargets({ value: item }));
	}

	return isRecord(value) ? Object.values(value).flatMap((item) => collectTargets({ value: item })) : [];
};

const parseManifest = ({ text }: { text: string }) => {
	try {
		const data: unknown = JSON.parse(text);

		return isRecord(data) ? data : undefined;
	} catch {
		return undefined;
	}
};

interface Params {
	/** The run's file text, which carries every package.json above a judged file. */
	contents: Map<string, string>;
}

/**
 * Both halves are needed because a manifest may name its entry in the built
 * output rather than the source: `"exports": "./dist/index.js"` publishes a
 * file this run never sees, while the `src/index.ts` it is built from sits
 * right here. So a package's root and its `src/` are entry folders whatever the
 * manifest says, and every file the manifest does name — a subpath export such
 * as `./contracts` pointing into `src/contracts/index.ts` — is an entry too.
 *
 * A repo carrying no manifest at all is one package rooted at `.`, the same
 * reading the dependency map gives it.
 */
export const readPackageEntries = ({ contents }: Params): PackageEntries => {
	const packageDirectories = new Set<string>();
	const entryFiles = new Set<string>();

	for (const [path, text] of contents) {
		const manifest = path === 'package.json' || path.endsWith('/package.json') ? parseManifest({ text }) : undefined;

		if (manifest === undefined) {
			continue;
		}

		const directory = getDirectory({ path });

		packageDirectories.add(directory);

		for (const target of entryFields.flatMap((field) => collectTargets({ value: manifest[field] }))) {
			entryFiles.add(joinPath({ from: directory, specifier: target }));
		}
	}

	if (packageDirectories.size === 0) {
		packageDirectories.add('.');
	}

	return { packageDirectories, entryFiles };
};
