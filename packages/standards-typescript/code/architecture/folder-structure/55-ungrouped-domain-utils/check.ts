import type { RawStandardsFinding, StandardsCheckModule } from '@lightsout/standards-contracts';
import { readPathLists } from '#common/checkInput/readPathLists.ts';
import { buildRawFinding } from '#common/findings/buildRawFinding.ts';
import { getExportName } from '#common/naming/getExportName.ts';
import { getBaseName } from '#common/paths/getBaseName.ts';
import { getDirectory } from '#common/paths/getDirectory.ts';

/**
 * Leading verbs that say how a value is reached rather than what it is about.
 * Grouping on them yields `predicates/` or `getters/`, folders named for the
 * ROLE of their code, which this document bans outright.
 */
const accessVerbs = new Set([
	'is',
	'has',
	'can',
	'should',
	'was',
	'get',
	'set',
	'read',
	'write',
	'load',
	'save',
	'fetch',
	'list',
	'collect',
	'gather',
	'to',
	'as',
	'from',
	'with',
	'on',
	'create',
	'make',
	'new',
	'build',
	'init',
	'resolve',
	'find',
	'lookup',
	'run',
	'invoke',
	'call',
	'execute',
	'apply',
]);

const getFirstToken = ({ name }: { name: string }) =>
	name
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.split(/[\s\-_.]+/)[0]
		?.toLowerCase() ?? '';

const groupUtilsByVerb = ({ files }: { files: string[] }) => {
	const byDirectory = new Map<string, Map<string, string[]>>();

	for (const file of files) {
		const directory = getDirectory({ path: file });

		if (getBaseName({ path: directory }) === 'utils') {
			const group = byDirectory.get(directory) ?? new Map<string, string[]>();
			const verb = getFirstToken({ name: getExportName({ path: file }) });

			group.set(verb, [...(group.get(verb) ?? []), file]);
			byDirectory.set(directory, group);
		}
	}

	return byDirectory;
};

export const check: StandardsCheckModule = {
	inputKind: 'file-list',
	// Only inside a `utils/` folder: the same repeated verb elsewhere is ordinary
	// domain code that already sits where it belongs. Advisory, because the
	// second function may be one commit away from making the group real.
	run: ({ input }): RawStandardsFinding[] => {
		const { files, tests } = readPathLists({ input });
		const testPaths = new Set(tests);
		const findings: RawStandardsFinding[] = [];

		for (const [directory, group] of groupUtilsByVerb({ files: files.filter((file) => !testPaths.has(file)) })) {
			for (const [verb, paths] of group) {
				if (paths.length > 1 && verb !== '' && !accessVerbs.has(verb)) {
					findings.push(
						buildRawFinding({
							rule: 'ungrouped-domain-utils',
							files: paths.map((path) => ({ path })),
							detail: `${paths.length} '${verb}*' functions in ${directory}`,
							guidance: 'If they share a subject, move them into a folder named for it, next to `utils/`. Heuristic — judge before acting.',
						}),
					);
				}
			}
		}

		return findings;
	},
};
