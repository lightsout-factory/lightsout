import type { RawStandardsFinding, StandardsCheckModule, SyntaxTreeInput } from '@lightsout/standards-contracts';
import type ts from 'typescript';
import { buildRawFinding } from '../findings/buildRawFinding.ts';
import { collectFunctionNodes } from '../parsing/collectFunctionNodes.ts';
import type { FunctionSizeCap } from '../types/FunctionSizeCap.ts';

interface Oversized extends FunctionSizeCap {
	name: string;
	lines: number;
	startLine: number;
	endLine: number;
}

type GetSizeCap = ({ name, path, options }: { name: string; path: string; options: Record<string, number> }) => FunctionSizeCap;

interface Params {
	rule: string;
	/** The cap one named function is measured against, and the word a finding uses for it. */
	getSizeCap: GetSizeCap;
}

/**
 * A callback nobody named inherits its parent's budget rather than earning one
 * of its own: the parent is the function anyone would split.
 */
const getOversized = ({
	path,
	sourceFile,
	compiler,
	options,
	getSizeCap,
}: {
	path: string;
	sourceFile: ts.SourceFile;
	compiler: typeof ts;
	options: Record<string, number>;
	getSizeCap: GetSizeCap;
}) => {
	const found: Oversized[] = [];

	for (const { name, startLine, endLine } of collectFunctionNodes({ sourceFile, compiler })) {
		const { cap, kind } = getSizeCap({ name, path, options });
		const lines = endLine - startLine + 1;

		if (lines > cap && name !== '(anonymous)') {
			found.push({ kind, name, lines, cap, startLine, endLine });
		}
	}

	return found;
};

/**
 * One finding per file: the work is "open this file and extract", which does not
 * become three jobs because three functions in it are long.
 */
const buildFileFindings = ({ input, options, rule, getSizeCap }: Params & { input: SyntaxTreeInput; options: Record<string, number> }) => {
	const findings: RawStandardsFinding[] = [];

	for (const [path, sourceFile] of input.trees) {
		const oversized = getOversized({ path, sourceFile, compiler: input.compiler, options, getSizeCap });

		if (oversized.length > 0) {
			findings.push(
				buildRawFinding({
					rule,
					files: oversized.map(({ startLine, endLine }) => ({ path, startLine, endLine })),
					detail: oversized.map(({ kind, name, lines, cap }) => `${kind} '${name}' is ${lines} lines (cap ~${cap})`).join('; '),
					guidance: 'Split the function into named pieces.',
					// One finding covers every oversized function in the file, so the measure
					// sums them: it rises when one grows and when a second goes over the cap,
					// which are the two ways this one site gets worse.
					measure: oversized.reduce((total, { lines }) => total + lines, 0),
				}),
			);
		}
	}

	return findings;
};

/**
 * Measured from the tree rather than counted off the text: a function runs
 * from its signature to its closing brace, and only the parse says where
 * either of those is.
 */
export const buildFunctionSizeCheck = ({ rule, getSizeCap }: Params): StandardsCheckModule => ({
	inputKinds: ['syntax-tree'],
	run: ({ inputs, options }): RawStandardsFinding[] => {
		const input = inputs['syntax-tree'];

		return input === undefined ? [] : buildFileFindings({ input, options, rule, getSizeCap });
	},
});
