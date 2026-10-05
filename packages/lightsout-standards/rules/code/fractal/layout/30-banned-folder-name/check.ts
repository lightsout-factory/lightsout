import type { RawStandardsFinding, StandardsCheckModule } from '@lightsout/standards-contracts';
import { readPathLists } from '#common/checkInput/readPathLists.ts';
import { bannedFolderNames } from '#common/constants/bannedFolderNames.ts';
import { buildRawFinding } from '#common/findings/buildRawFinding.ts';
import { collectDirectories } from '#common/paths/collectDirectories.ts';
import { getBaseName } from '#common/paths/getBaseName.ts';
import { getDirectory } from '#common/paths/getDirectory.ts';
import { getPackageSourceRoot } from '#common/paths/getPackageSourceRoot.ts';

/** The two folders a `common/` keeps for one kind of code. The same names anywhere else mean files sorted by kind instead of by subject. */
const kindFolderNames = new Set(['types', 'constants']);

/** What is wrong with one folder's name where it sits, or undefined when the name is fine. */
const judgeFolder = ({ directory }: { directory: string }) => {
	const name = getBaseName({ path: directory });

	if (bannedFolderNames.has(name)) {
		return {
			detail: `folder '${name}' is named for the kind of code it holds`,
			guidance: 'Name the folder for its subject, or move its files beside the code that uses them.',
		};
	}

	return kindFolderNames.has(name) && getBaseName({ path: getDirectory({ path: directory }) }) !== 'common'
		? {
				detail: `folder '${name}' sits outside the top of a common/`,
				guidance: 'Move its files to the `types/` or `constants/` at the top of the `common/` that serves their users.',
			}
		: undefined;
};

export const check: StandardsCheckModule = {
	inputKinds: ['file-list'],
	// The names on the list are the code's to report. Any other name that says
	// the kind of code rather than its subject is the agent's to judge, which
	// is why the rule has both kinds of check.
	run: ({ inputs }): RawStandardsFinding[] => {
		const { files } = readPathLists({ input: inputs['file-list'] });
		const packageDirectories = [...(inputs['file-list']?.dependencies ?? new Map<string, string[]>()).keys()];

		return [...collectDirectories({ files })]
			.sort()
			.filter((directory) => directory.startsWith(getPackageSourceRoot({ path: directory, packageDirectories })))
			.flatMap((directory) => {
				const verdict = judgeFolder({ directory });

				return verdict === undefined ? [] : [buildRawFinding({ rule: 'banned-folder-name', files: [{ path: directory }], ...verdict })];
			});
	},
};
