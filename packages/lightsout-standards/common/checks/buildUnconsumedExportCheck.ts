import type { StandardsCheckModule } from '@lightsout/standards-contracts';
import { readFileTexts } from '../checkInput/readFileTexts.ts';
import { readManifestDependencies } from '../checkInput/readManifestDependencies.ts';
import { buildUnconsumedFindings } from '../findings/buildUnconsumedFindings.ts';
import { getFrameworkCarveOuts } from '../frameworks/getFrameworkCarveOuts.ts';
import type { UnconsumedExport } from '../types/UnconsumedExport.ts';

interface Params {
	rule: string;
	/** Which unconsumed exports this rule claims — the verdicts are mutually exclusive, so each export lands in at most one rule. */
	matches: ({ test }: UnconsumedExport['reachedBy']) => boolean;
	/** Completes the sentence "'a', 'b' are …" — e.g. `referenced nowhere else`. */
	detail: string;
	guidance: string;
}

/**
 * The framework carve-outs are derived here rather than taken as a parameter,
 * because every rule that uses this builder wants the same answer and none of
 * them should have to ask for it.
 */
export const buildUnconsumedExportCheck = ({ rule, matches, detail, guidance }: Params): StandardsCheckModule => ({
	inputKind: 'file-text',
	run: ({ input }) => {
		const { files, contents, standardsLibraries } = readFileTexts({ input });
		const carveOuts = getFrameworkCarveOuts({ dependencies: readManifestDependencies({ contents }) });

		return buildUnconsumedFindings({ files, contents, standardsLibraries, carveOuts, rule, matches, detail, guidance });
	},
});
