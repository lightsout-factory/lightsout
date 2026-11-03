import type { RawStandardsFinding, StandardsCheckModule } from '@lightsout/standards-contracts';
import { readPathLists } from '#common/checkInput/readPathLists.ts';
import { buildRawFinding } from '#common/findings/buildRawFinding.ts';
import { collectDirectories } from '#common/paths/collectDirectories.ts';
import { findComponentFolders } from '#common/paths/findComponentFolders.ts';
import { getBaseName } from '#common/paths/getBaseName.ts';
import { getDirectory } from '#common/paths/getDirectory.ts';
import { getSourceRelativePath } from '#common/paths/getSourceRelativePath.ts';

const rule = 'component-folder';

interface Tree {
	componentFolders: Set<string>;
	/** Source files directly inside each folder, tests left out. */
	filesByFolder: Map<string, string[]>;
	/** Every folder that holds another folder. */
	parentFolders: Set<string>;
}

/** The segments of a path below its `components/`, or undefined for a path with no `components/` above it. */
const getSegmentsBelowComponents = ({ relative }: { relative: string }) => {
	const segments = relative.split('/');
	const index = segments.indexOf('components');

	return index === -1 ? undefined : segments.slice(index + 1);
};

/** What is wrong with one folder below a `components/`, or undefined when it is a component folder in its place. */
const judgeFolder = ({ directory, relative, tree }: { directory: string; relative: string; tree: Tree }) => {
	const name = getBaseName({ path: directory });
	const parent = getDirectory({ path: directory });
	const below = getSegmentsBelowComponents({ relative }) ?? [];

	if (below.length === 0) {
		return undefined;
	}

	if (tree.componentFolders.has(parent)) {
		return {
			detail: `folder '${name}' sits inside component folder '${getBaseName({ path: parent })}'`,
			guidance: 'A part with parts of its own is a component in its own right: move it up to components/ and give it a folder of its own there.',
		};
	}

	if (!tree.componentFolders.has(directory)) {
		// A group directly under a shared components/ is the shared-layer rule's; a folder in a feature's components/ is always a component folder.
		return relative.startsWith('features/')
			? {
					detail: `folder '${name}' in components/ has no component of its name`,
					guidance: "A folder in a feature's components/ is a component folder: name it after the component it holds, or move its files up into components/.",
				}
			: undefined;
	}

	return (tree.filesByFolder.get(directory)?.length ?? 0) === 1 && !tree.parentFolders.has(directory)
		? { detail: `folder '${name}' holds only its main file`, guidance: 'Turn it back into a file: move the component up one folder and delete this one.' }
		: undefined;
};

const buildTree = ({ sources }: { sources: string[] }): Tree => {
	const filesByFolder = new Map<string, string[]>();

	for (const file of sources) {
		const directory = getDirectory({ path: file });

		filesByFolder.set(directory, [...(filesByFolder.get(directory) ?? []), file]);
	}

	return {
		componentFolders: findComponentFolders({ files: sources }),
		filesByFolder,
		parentFolders: new Set([...collectDirectories({ files: sources })].map((directory) => getDirectory({ path: directory }))),
	};
};

export const check: StandardsCheckModule = {
	inputKinds: ['file-list'],
	// A component folder is told from a group by a file of its own name, so
	// the whole rule is read from paths. Tests are not counted: a component's
	// test moves with it.
	run: ({ inputs }): RawStandardsFinding[] => {
		const { files, tests } = readPathLists({ input: inputs['file-list'] });
		const testPaths = new Set(tests);
		const sources = files.filter((path) => !testPaths.has(path));
		const packageDirectories = [...(inputs['file-list']?.dependencies ?? new Map<string, string[]>()).keys()];
		const tree = buildTree({ sources });

		return [...collectDirectories({ files: sources })].sort().flatMap((directory) => {
			const relative = getSourceRelativePath({ path: directory, packageDirectories });
			const verdict = relative === undefined ? undefined : judgeFolder({ directory, relative, tree });

			return verdict === undefined ? [] : [buildRawFinding({ rule, files: [{ path: directory }], ...verdict })];
		});
	},
};
