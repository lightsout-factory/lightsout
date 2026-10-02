import type { RawStandardsFinding } from '@lightsout/standards-contracts';
import { getUnconsumedExports } from '../modules/getUnconsumedExports.ts';
import type { FrameworkCarveOut } from '../types/FrameworkCarveOut.ts';
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
	/** Completes the sentence "'a', 'b' are …" — e.g. `referenced nowhere else`. */
	detail: string;
	guidance: string;
}

/** One finding per file, naming every unconsumed export it declares. */
export const buildUnconsumedFindings = ({ files, contents, standardsLibraries, carveOuts, rule, detail, guidance }: Params): RawStandardsFinding[] => {
	const byFile = new Map<string, string[]>();

	for (const { file, name } of getUnconsumedExports({ files, contents, standardsLibraries, carveOuts })) {
		byFile.set(file, [...(byFile.get(file) ?? []), name]);
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
