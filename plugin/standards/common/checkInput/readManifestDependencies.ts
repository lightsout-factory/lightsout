import { getDirectory } from '../paths/getDirectory.ts';
import { isRecord } from '../utils/isRecord.ts';

const readNames = ({ text }: { text: string }) => {
	let data: unknown;

	try {
		data = JSON.parse(text);
	} catch {
		return undefined;
	}

	const manifest = isRecord(data) ? data : undefined;

	if (manifest === undefined) {
		return undefined;
	}

	return ['dependencies', 'devDependencies', 'peerDependencies'].flatMap((field) => {
		const declared = manifest[field];

		return isRecord(declared) ? Object.keys(declared) : [];
	});
};

interface Params {
	/** The run's file text, which carries every package.json above a judged file. */
	contents: Map<string, string>;
}

/**
 * Keyed by the package's directory. The file-list input carries this map
 * ready-made; a file-text input carries only the manifests, so a rule that
 * judges text can ask here rather than declare a second input kind.
 *
 * The union of the three dependency fields is deliberate, and matches how the
 * engine builds the same map: "does this package use TanStack Router?" is a
 * question about what a package declares, not about which field it declared it
 * in.
 */
export const readManifestDependencies = ({ contents }: Params): Map<string, string[]> => {
	const dependencies = new Map<string, string[]>();

	for (const [path, text] of contents) {
		if (path !== 'package.json' && !path.endsWith('/package.json')) {
			continue;
		}

		const names = readNames({ text });

		if (names !== undefined) {
			dependencies.set(getDirectory({ path }), names);
		}
	}

	return dependencies;
};
