import type { RawStandardsFinding } from '@lightsout/standards-contracts';
import { getUnconsumedExports } from '../modules/getUnconsumedExports.ts';
import type { FrameworkCarveOut } from '../types/FrameworkCarveOut.ts';
import type { UnconsumedExport } from '../types/UnconsumedExport.ts';
import { buildRawFinding } from './buildRawFinding.ts';

interface Params {
	files: string[];
	/** Text for every file in scope and every reference file. */
	contents: Map<string, string>;
	/** Repo-relative standards pack roots, forwarded to the reference counting. */
	standardsLibraries: string[];
	/** Every package's framework carve-outs, forwarded to the reference counting. */
	carveOuts: FrameworkCarveOut[];
	rule: string;
	/** Which unconsumed exports this rule claims — the verdicts are mutually exclusive, so each export lands in at most one rule. */
	matches: ({ test }: UnconsumedExport['reachedBy']) => boolean;
	/** Completes the sentence "'a', 'b' are …" — e.g. `referenced nowhere else`. */
	detail: string;
	guidance: string;
}

/**
 * Split into several rules rather than one so a repo can switch off the verdict
 * it disagrees with — a deliberate public API is not a defect — while keeping
 * the others.
 */
export const buildUnconsumedFindings = ({ files, contents, standardsLibraries, carveOuts, rule, matches, detail, guidance }: Params): RawStandardsFinding[] => {
	const byFile = new Map<string, string[]>();

	for (const { file, name, reachedBy } of getUnconsumedExports({ files, contents, standardsLibraries, carveOuts })) {
		if (matches(reachedBy)) {
			byFile.set(file, [...(byFile.get(file) ?? []), name]);
		}
	}

	return [...byFile].map(([file, names]) =>
		buildRawFinding({
			rule,
			files: [{ path: file }],
			detail: `${names.map((name) => `'${name}'`).join(', ')} ${names.length > 1 ? 'are' : 'is'} ${detail}`,
			guidance,
		}),
	);
};
