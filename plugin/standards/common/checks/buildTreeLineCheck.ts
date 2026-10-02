import type { RawStandardsFinding, StandardsCheckModule } from '@lightsout/standards-contracts';
import type ts from 'typescript';
import { buildRawFinding } from '../findings/buildRawFinding.ts';

interface Params {
	rule: string;
	/** The lines in one parsed file that violate the rule, in report order. */
	findLines: ({ sourceFile, compiler }: { sourceFile: ts.SourceFile; compiler: typeof ts }) => number[];
	/** The finding's detail, given the lines found — it names what sits on them. */
	detail: ({ lines }: { lines: number[] }) => string;
	guidance: string;
}

/**
 * One finding per file, never one per line: the work is "open this file and
 * fix what it says", which does not become three jobs because three lines say
 * it.
 */
export const buildTreeLineCheck = ({ rule, findLines, detail, guidance }: Params): StandardsCheckModule => ({
	inputKinds: ['syntax-tree'],
	run: ({ inputs }): RawStandardsFinding[] => {
		const input = inputs['syntax-tree'];

		if (input === undefined) {
			return [];
		}

		const findings: RawStandardsFinding[] = [];

		for (const [path, tree] of input.trees) {
			const lines = findLines({ sourceFile: tree, compiler: input.compiler });

			if (lines.length > 0) {
				findings.push(buildRawFinding({ rule, files: [{ path }], detail: detail({ lines }), guidance }));
			}
		}

		return findings;
	},
});
