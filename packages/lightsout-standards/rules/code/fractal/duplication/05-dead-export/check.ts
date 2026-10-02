import type { RawStandardsFinding, StandardsCheckModule } from '@lightsout/standards-contracts';
import { readFileTexts } from '#common/checkInput/readFileTexts.ts';
import { readManifestDependencies } from '#common/checkInput/readManifestDependencies.ts';
import { buildRawFinding } from '#common/findings/buildRawFinding.ts';
import { getFrameworkCarveOuts } from '#common/frameworks/getFrameworkCarveOuts.ts';
import { getUnconsumedExports } from '#common/modules/getUnconsumedExports.ts';

export const check: StandardsCheckModule = {
	inputKinds: ['file-text'],
	/**
	 * A folder barrel's mention does not count, since nothing imports through
	 * one. Any other mention does, even in a comment or a string, so calling a
	 * live export dead is rare. One finding per file, naming every dead export
	 * it declares. The framework carve-outs come from the manifests in scope, so
	 * a route file a router loads counts as the consumer of what it renders.
	 */
	run: ({ inputs }): RawStandardsFinding[] => {
		const { files, contents, standardsLibraries } = readFileTexts({ input: inputs['file-text'] });
		const carveOuts = getFrameworkCarveOuts({ dependencies: readManifestDependencies({ contents }) });
		const byFile = new Map<string, string[]>();

		for (const { file, name } of getUnconsumedExports({ files, contents, standardsLibraries, carveOuts })) {
			byFile.set(file, [...(byFile.get(file) ?? []), name]);
		}

		return [...byFile].map(([file, names]) =>
			buildRawFinding({
				rule: 'dead-export',
				files: [{ path: file }],
				detail: `${names.map((name) => `'${name}'`).join(', ')} ${names.length > 1 ? 'are' : 'is'} referenced nowhere else`,
				guidance: 'A dead code candidate. Delete it — version control has the history.',
			}),
		);
	},
};
