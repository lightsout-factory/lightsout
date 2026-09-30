import type { RawStandardsFinding, StandardsCheckModule, SyntaxTreeInput } from '@lightsout/standards-contracts';
import { buildRawFinding } from '../../../../../common/findings/buildRawFinding.ts';
import { isBarrelFile } from '../../../../../common/paths/isBarrelFile.ts';

/**
 * A barrel is exempt at any length: the remedy the finding asks for, split it
 * or graduate the concept, is what a module's public API cannot do.
 */
const buildFileFindings = ({ input, options }: { input: SyntaxTreeInput; options: Record<string, number> }) => {
	const findings: RawStandardsFinding[] = [];

	for (const [path, tree] of input.trees) {
		const lineCount = tree.getFullText().split('\n').length;
		const cap = path.endsWith('.tsx') ? options.tsxFile : options.file;

		if (lineCount > cap && !isBarrelFile({ path })) {
			findings.push(
				buildRawFinding({
					rule: 'file-size',
					files: [{ path }],
					detail: `${lineCount} lines (cap ~${cap})`,
					guidance: 'Split the file, or graduate the concept it has grown into.',
					// The length, not the distance past the cap, so the same file measures
					// the same however the cap is retuned.
					measure: lineCount,
				}),
			);
		}
	}

	return findings;
};

export const check: StandardsCheckModule = {
	inputKind: 'syntax-tree',
	// The line count itself needs no parse, but the rule rides along with the
	// tree the size and duplication rules already paid for, so the file is read
	// once for all of them.
	run: ({ input, options }): RawStandardsFinding[] => (input.kind === 'syntax-tree' ? buildFileFindings({ input, options }) : []),
};
