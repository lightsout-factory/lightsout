import type { RawStandardsFinding, StandardsCheckModule } from '@lightsout/standards-contracts';
import { readPathLists } from '#common/checkInput/readPathLists.ts';
import { sharedLayerFolderNames } from '#common/constants/sharedLayerFolderNames.ts';
import { buildRawFinding } from '#common/findings/buildRawFinding.ts';
import { findComponentFolders } from '#common/paths/findComponentFolders.ts';
import { getSourceRelativePath } from '#common/paths/getSourceRelativePath.ts';

const rule = 'shared-layer';
const sharedFolders = 'components/, layouts/, providers/, hooks/, utils/, types/, constants/, styles/ or assets/';

/** The shared folders that hold files only: `components/` may group by subject, and `styles/` and `assets/` are the bundler's. */
const flatFolders = new Set(['layouts', 'providers', 'hooks', 'utils', 'types', 'constants']);

/** A folder inside a group of `components/` that is neither a component folder nor a component: a group in a group. */
const judgeComponentsPath = ({ prefix, segments, componentFolders }: { prefix: string; segments: string[]; componentFolders: Set<string> }) => {
	const [, group, child, ...deeper] = segments;

	if (group === undefined || child === undefined || deeper.length === 0 || componentFolders.has(`${prefix}components/${group}`)) {
		return undefined;
	}

	const folder = `${prefix}components/${group}/${child}`;

	return componentFolders.has(folder)
		? undefined
		: {
				path: folder,
				detail: `folder '${child}' groups files inside components/${group}/`,
				guidance: `A group in components/ holds components and their folders only: move its files up into components/${group}/, or make it a group of its own directly under components/.`,
			};
};

/** What is wrong with where one file sits at the top of `src/`, or undefined when its place is fine or another rule's to judge. */
const judgeFile = ({ file, relative, componentFolders }: { file: string; relative: string; componentFolders: Set<string> }) => {
	const prefix = file.slice(0, file.length - relative.length);
	const segments = relative.split('/');
	const [top = '', child, ...deeper] = segments;

	if (child === undefined) {
		return undefined;
	}

	if (!sharedLayerFolderNames.has(top)) {
		return {
			path: `${prefix}${top}`,
			detail: `folder '${top}' is not one the top of src/ holds`,
			guidance: `Move its files into a feature, or into a shared folder named for its kind: ${sharedFolders}, or a folder the framework's rules add.`,
		};
	}

	if (top === 'components') {
		return judgeComponentsPath({ prefix, segments, componentFolders });
	}

	return flatFolders.has(top) && deeper.length > 0
		? {
				path: `${prefix}${top}/${child}`,
				detail: `folder '${child}' groups files inside ${top}/`,
				guidance: `A shared folder other than components/ is flat: move its files up into ${top}/.`,
			}
		: undefined;
};

export const check: StandardsCheckModule = {
	inputKinds: ['file-list'],
	// Which folders the top of src/ holds, and which of them are flat, are
	// facts of the paths. Whether a file has the two users that earn it a
	// place here is the agent's to judge, which is why the rule has both kinds
	// of check. Tests are not judged: a test sits beside its subject.
	run: ({ inputs }): RawStandardsFinding[] => {
		const { files, tests } = readPathLists({ input: inputs['file-list'] });
		const testPaths = new Set(tests);
		const sources = files.filter((path) => !testPaths.has(path)).sort();
		const packageDirectories = [...(inputs['file-list']?.dependencies ?? new Map<string, string[]>()).keys()];
		const componentFolders = findComponentFolders({ files: sources });
		const findings = new Map<string, RawStandardsFinding>();

		for (const file of sources) {
			const relative = getSourceRelativePath({ path: file, packageDirectories });
			const verdict = relative === undefined ? undefined : judgeFile({ file, relative, componentFolders });

			if (verdict !== undefined) {
				const finding = buildRawFinding({ rule, files: [{ path: verdict.path }], detail: verdict.detail, guidance: verdict.guidance });

				findings.set(finding.siteKey, finding);
			}
		}

		return [...findings.values()];
	},
};
