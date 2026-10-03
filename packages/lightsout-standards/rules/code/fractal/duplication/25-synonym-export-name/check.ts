import type { RawStandardsFinding, StandardsCheckModule } from '@lightsout/standards-contracts';
import { readPathLists } from '#common/checkInput/readPathLists.ts';
import { buildRawFinding } from '#common/findings/buildRawFinding.ts';
import { collapseCasing } from '#common/naming/collapseCasing.ts';
import { getExportName } from '#common/naming/getExportName.ts';
import { getNameKey } from '#common/naming/getNameKey.ts';

/**
 * Grouped within each key by the name the file uses, because the finding has to
 * name the spellings, not the key they share. Tests are left out: a test file is
 * named after the subject it covers.
 */
const groupByNameKey = ({ files, tests }: { files: string[]; tests: string[] }) => {
	const testPaths = new Set(tests);
	const byKey = new Map<string, Map<string, string[]>>();

	for (const file of files) {
		const name = getExportName({ path: file });

		// Every folder-module has an index, so the name says nothing about what
		// the file holds.
		if (!testPaths.has(file) && name !== 'index') {
			const key = getNameKey({ name });
			const group = byKey.get(key) ?? new Map<string, string[]>();

			group.set(name, [...(group.get(name) ?? []), file]);
			byKey.set(key, group);
		}
	}

	return byKey;
};

/**
 * Names identical once casing and separators are dropped (`GetStarted` vs
 * `get-started`) are a framework pair — a component and the kebab-case route
 * that renders it — not one concept living under two verbs.
 */
const isFrameworkPair = ({ names }: { names: string[] }) => new Set(names.map((name) => collapseCasing({ name }))).size < 2;

export const check: StandardsCheckModule = {
	inputKinds: ['file-list'],
	// Tier 0 of the duplication ladder, alongside the duplicate-name rule: one
	// export per file makes a filename an export name, so the whole comparison
	// runs before any file is opened. Advisory, because the vocabulary's own
	// carve-out — a domain that standardized on `fetchData` keeps its verb —
	// makes some of these deliberate.
	run: ({ inputs }): RawStandardsFinding[] => {
		const { files, tests } = readPathLists({ input: inputs['file-list'] });

		return [...groupByNameKey({ files, tests }).values()]
			.filter((group) => group.size > 1 && !isFrameworkPair({ names: [...group.keys()] }))
			.map((group) =>
				buildRawFinding({
					rule: 'synonym-export-name',
					files: [...group.values()].flat().map((path) => ({ path })),
					detail: `${[...group.keys()].map((name) => `'${name}'`).join(', ')} differ only by synonym or word order`,
					guidance: 'Likely one concept living under two names.',
				}),
			);
	},
};
