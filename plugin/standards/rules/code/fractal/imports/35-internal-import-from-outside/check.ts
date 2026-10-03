import type { RawStandardsFinding, StandardsCheckModule } from '@lightsout/standards-contracts';
import { buildRawFinding } from '#common/findings/buildRawFinding.ts';

/** A path with nested `internal/` folders is private to each of them in turn, and an importer has to be inside all. */
const getOwners = ({ path }: { path: string }) => {
	const segments = path.split('/').slice(0, -1);

	return segments.flatMap((segment, index) => (segment === 'internal' ? [segments.slice(0, index).join('/')] : []));
};

const isInside = ({ file, folder }: { file: string; folder: string }) => folder === '' || file.startsWith(`${folder}/`);

interface Crossing {
	from: string;
	owner: string;
	targets: string[];
}

export const check: StandardsCheckModule = {
	inputKinds: ['import-graph'],
	/**
	 * Decided from the two paths alone, so there is no list of private files to
	 * drift. Every file one importer reaches in one folder's `internal/` is ONE
	 * finding: the fix is a single decision about that import.
	 */
	run: ({ inputs }): RawStandardsFinding[] => {
		const input = inputs['import-graph'];

		if (input === undefined) {
			return [];
		}

		const scope = new Set(input.files);
		const crossings = new Map<string, Crossing>();

		for (const { from, to } of input.edges) {
			if (!scope.has(from)) {
				continue;
			}

			for (const owner of getOwners({ path: to }).filter((folder) => !isInside({ file: from, folder }))) {
				const key = `${from}\0${owner}`;
				const crossing = crossings.get(key) ?? { from, owner, targets: [] };

				crossings.set(key, { ...crossing, targets: crossing.targets.includes(to) ? crossing.targets : [...crossing.targets, to] });
			}
		}

		return [...crossings.values()].map(({ from, owner, targets }) =>
			buildRawFinding({
				rule: 'internal-import-from-outside',
				files: [{ path: from }, ...targets.map((path) => ({ path }))],
				detail: `imports ${targets.map((path) => `'${path}'`).join(', ')} — internal to '${owner}', which '${from}' is outside of`,
				guidance: 'A file under internal/ is private to the folder holding it — move it out of internal/ to share it, or keep the import inside that folder.',
			}),
		);
	},
};
