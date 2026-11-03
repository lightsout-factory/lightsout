import type { RawStandardsFinding, StandardsCheckModule } from '@lightsout/standards-contracts';
import { buildRawFinding } from '#common/findings/buildRawFinding.ts';
import { getBaseName } from '#common/paths/getBaseName.ts';
import { getSourceRelativePath } from '#common/paths/getSourceRelativePath.ts';

const rule = 'feature-layout';

/** The folders of a feature a route may import from: what it renders, what it prefetches, what parses its search, and what runs on the server. */
const routeReach = new Set(['screens', 'queries', 'utils', 'server']);

/** The feature folder an import from a route lands in, or undefined when the import is not into a feature or lands where a route may reach. */
const judgeEdge = ({ from, relativeFrom, relativeTo }: { from: string; relativeFrom: string; relativeTo: string }) => {
	const [top, feature, kind] = relativeTo.split('/');

	if (!relativeFrom.startsWith('routes/') || top !== 'features' || feature === undefined || (kind !== undefined && routeReach.has(kind))) {
		return undefined;
	}

	return {
		detail: `route '${getBaseName({ path: from })}' imports '${relativeTo}' from outside screens/, queries/, utils/ or server/`,
		guidance: 'Reach a feature through its screens/, queries/, utils/ or server/; move what the route needs into one of them.',
	};
};

export const check: StandardsCheckModule = {
	inputKinds: ['import-graph'],
	// Where a route reaches into a feature is read from its imports. Which
	// folders a feature holds is the React layout rules' to judge, with this
	// pack's queries/ and server/ left out of their findings.
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
			const verdict =
				relativeFrom === undefined || relativeTo === undefined || testPaths.has(from) || testPaths.has(to)
					? undefined
					: judgeEdge({ from, relativeFrom, relativeTo });

			if (verdict !== undefined) {
				const finding = buildRawFinding({ rule, files: [{ path: from }, { path: to }], ...verdict });

				findings.set(finding.siteKey, finding);
			}
		}

		return [...findings.keys()].sort().flatMap((key) => findings.get(key) ?? []);
	},
};
