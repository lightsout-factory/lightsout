import type { RawStandardsFinding, StandardsCheckModule } from '@lightsout/standards-contracts';
import { sharedLayerFolderNames } from '#common/constants/sharedLayerFolderNames.ts';
import { buildRawFinding } from '#common/findings/buildRawFinding.ts';
import { getBaseName } from '#common/paths/getBaseName.ts';
import { getSourceRelativePath } from '#common/paths/getSourceRelativePath.ts';

const rule = 'feature-import-direction';

type Place = { layer: 'feature'; name: string } | { layer: 'shared' } | { layer: 'app' };

/**
 * Which layer a file is in. A top-level file, the routing layer and any folder
 * the rule does not know are the app above the features, which may import
 * anything; a framework's folders fall there too.
 */
const placeOf = ({ relative }: { relative: string }): Place => {
	const [top = '', second] = relative.split('/');

	if (top === 'features') {
		return second === undefined ? { layer: 'app' } : { layer: 'feature', name: second };
	}

	return second !== undefined && sharedLayerFolderNames.has(top) ? { layer: 'shared' } : { layer: 'app' };
};

/** What is wrong with one import, or undefined when it flows the right way. */
const judgeEdge = ({ from, relativeFrom, relativeTo }: { from: string; relativeFrom: string; relativeTo: string }) => {
	const source = placeOf({ relative: relativeFrom });
	const target = placeOf({ relative: relativeTo });

	if (target.layer !== 'feature') {
		return undefined;
	}

	if (source.layer === 'feature' && source.name !== target.name) {
		return {
			detail: `'${getBaseName({ path: from })}' in feature '${source.name}' imports from feature '${target.name}'`,
			guidance: 'Move what both features need into the shared layer and import it from there.',
		};
	}

	return source.layer === 'shared'
		? {
				detail: `'${getBaseName({ path: from })}' in the shared layer imports from feature '${target.name}'`,
				guidance: 'Move the shared file into that feature, or move what it needs out of the feature into the shared layer.',
			}
		: undefined;
};

export const check: StandardsCheckModule = {
	inputKinds: ['import-graph'],
	// Direction is read from the two ends of each import. An import from or to
	// a test is not the source reaching across; an import across packages is
	// the package entry's business, not this rule's.
	run: ({ inputs }): RawStandardsFinding[] => {
		const input = inputs['import-graph'];

		if (input === undefined) {
			return [];
		}

		const testPaths = new Set(input.tests);
		const packageDirectories = [...input.dependencies.keys()];
		const findings = new Map<string, RawStandardsFinding>();

		for (const { from, to } of input.edges) {
			const relativeFrom = getSourceRelativePath({ path: from, packageDirectories });
			const relativeTo = getSourceRelativePath({ path: to, packageDirectories });
			const samePackage = relativeFrom !== undefined && relativeTo !== undefined && from.slice(0, -relativeFrom.length) === to.slice(0, -relativeTo.length);
			const verdict = samePackage && !testPaths.has(from) && !testPaths.has(to) ? judgeEdge({ from, relativeFrom, relativeTo }) : undefined;

			if (verdict !== undefined) {
				const finding = buildRawFinding({ rule, files: [{ path: from }, { path: to }], ...verdict });

				findings.set(finding.siteKey, finding);
			}
		}

		return [...findings.keys()].sort().flatMap((key) => findings.get(key) ?? []);
	},
};
