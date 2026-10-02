import type { StandardsCheckModule } from '@lightsout/standards-contracts';
import { readFileTexts } from '../checkInput/readFileTexts.ts';
import { readManifestDependencies } from '../checkInput/readManifestDependencies.ts';
import { buildUnconsumedFindings } from '../findings/buildUnconsumedFindings.ts';
import { getFrameworkCarveOuts } from '../frameworks/getFrameworkCarveOuts.ts';

interface Params {
	rule: string;
	/** Completes the sentence "'a', 'b' are …" — e.g. `referenced nowhere else`. */
	detail: string;
	guidance: string;
}

/**
 * The framework carve-outs are derived here rather than taken as a parameter,
 * so a rule that uses this builder does not have to ask for them.
 */
export const buildUnconsumedExportCheck = ({ rule, detail, guidance }: Params): StandardsCheckModule => ({
	inputKind: 'file-text',
	run: ({ input }) => {
		const { files, contents, standardsLibraries } = readFileTexts({ input });
		const carveOuts = getFrameworkCarveOuts({ dependencies: readManifestDependencies({ contents }) });

		return buildUnconsumedFindings({ files, contents, standardsLibraries, carveOuts, rule, detail, guidance });
	},
});
