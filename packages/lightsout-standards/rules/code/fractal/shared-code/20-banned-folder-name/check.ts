import type { RawStandardsFinding, StandardsCheckModule } from '@lightsout/standards-contracts';
import { readPathLists } from '#common/checkInput/readPathLists.ts';
import { buildRawFinding } from '#common/findings/buildRawFinding.ts';
import { collectDirectories } from '#common/paths/collectDirectories.ts';
import { getBaseName } from '#common/paths/getBaseName.ts';
import { getPackageSourceRoot } from '#common/paths/getPackageSourceRoot.ts';

/** Banned at every level, even inside `common/`. */
const bannedAnywhere = new Set(['helpers', 'lib', 'core', 'misc', 'shared']);

/**
 * Kind-buckets with a sanctioned home: `common/utils/`, `common/types/` and
 * `common/constants/` are the mandated skeleton, so the same names outside a
 * `common/` mean files sorted by kind instead of by domain.
 */
const bannedOutsideCommon = new Set(['utils', 'types', 'constants']);

export const check: StandardsCheckModule = {
	inputKinds: ['file-list'],
	run: ({ inputs }): RawStandardsFinding[] => {
		const { files } = readPathLists({ input: inputs['file-list'] });
		const packageDirectories = [...(inputs['file-list']?.dependencies ?? new Map<string, string[]>()).keys()];
		const findings: RawStandardsFinding[] = [];

		for (const directory of [...collectDirectories({ files })].sort()) {
			if (!directory.startsWith(getPackageSourceRoot({ path: directory, packageDirectories }))) {
				continue;
			}

			const name = getBaseName({ path: directory });
			const insideCommon = directory.split('/').slice(0, -1).includes('common');
			const banned = bannedAnywhere.has(name) || (bannedOutsideCommon.has(name) && !insideCommon);

			if (banned) {
				findings.push(
					buildRawFinding({
						rule: 'banned-folder-name',
						files: [{ path: directory }],
						detail: `folder '${name}' names the role of the code it holds`,
						guidance:
							'Name the folder for the domain it serves, or fold its files into the module that owns them — the only privileged folder name at any level is `common/`.',
					}),
				);
			}
		}

		return findings;
	},
};
