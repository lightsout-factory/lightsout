import type { RawStandardsFinding, StandardsCheckModule } from '@lightsout/standards-contracts';
import { readPathLists } from '#common/checkInput/readPathLists.ts';
import { featureFolderNames } from '#common/constants/featureFolderNames.ts';
import { buildRawFinding } from '#common/findings/buildRawFinding.ts';
import { getBaseName } from '#common/paths/getBaseName.ts';
import { getSourceRelativePath } from '#common/paths/getSourceRelativePath.ts';

const rule = 'feature-folders';
const kindFolders = 'screens/, components/, hooks/, utils/, types/ or constants/';

/** What is wrong with where one file sits under `features/`, or undefined when its place is fine. */
const judgeFile = ({ file, relative }: { file: string; relative: string }) => {
	const prefix = file.slice(0, file.length - relative.length);
	const [, feature = '', kind, part, ...deeper] = relative.split('/');

	if (kind === undefined) {
		return {
			path: file,
			detail: `'${getBaseName({ path: file })}' sits in features/ outside any feature`,
			guidance: 'Move it into the feature it belongs to, under the folder for its kind.',
		};
	}

	if (part === undefined) {
		return {
			path: file,
			detail: `'${getBaseName({ path: file })}' sits directly under feature '${feature}'`,
			guidance: `Move it into ${kindFolders}, or into a folder the framework's rules add.`,
		};
	}

	if (!featureFolderNames.has(kind)) {
		return {
			path: `${prefix}features/${feature}/${kind}`,
			detail: `folder '${kind}' is not one a feature holds`,
			guidance: `Move its files into ${kindFolders}, or into a folder the framework's rules add.`,
		};
	}

	// Component folders are component-folder's to judge; every other folder in a feature is flat.
	return kind !== 'components' && deeper.length > 0
		? {
				path: `${prefix}features/${feature}/${kind}/${part}`,
				detail: `folder '${part}' groups files inside ${kind}/`,
				guidance: `Every folder in a feature is flat: move its files up into ${kind}/.`,
			}
		: undefined;
};

export const check: StandardsCheckModule = {
	inputKinds: ['file-list'],
	// A feature's shape is read from paths alone. Tests are not judged: a test
	// sits beside its subject, wherever that is.
	run: ({ inputs }): RawStandardsFinding[] => {
		const { files, tests } = readPathLists({ input: inputs['file-list'] });
		const testPaths = new Set(tests);
		const packageDirectories = [...(inputs['file-list']?.dependencies ?? new Map<string, string[]>()).keys()];
		const findings = new Map<string, RawStandardsFinding>();

		for (const file of files.filter((path) => !testPaths.has(path)).sort()) {
			const relative = getSourceRelativePath({ path: file, packageDirectories });
			const verdict = relative?.startsWith('features/') ? judgeFile({ file, relative }) : undefined;

			if (verdict !== undefined) {
				const finding = buildRawFinding({ rule, files: [{ path: verdict.path }], detail: verdict.detail, guidance: verdict.guidance });

				findings.set(finding.siteKey, finding);
			}
		}

		return [...findings.values()];
	},
};
