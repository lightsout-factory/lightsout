import type { RawStandardsFinding, StandardsCheckModule, SyntaxTreeInput } from '@lightsout/standards-contracts';
import type ts from 'typescript';
import { buildRawFinding } from '../../../../../common/findings/buildRawFinding.ts';
import { collectFunctionNodes } from '../../../../../common/parsing/collectFunctionNodes.ts';

interface Oversized {
	kind: string;
	name: string;
	lines: number;
	cap: number;
	startLine: number;
	endLine: number;
}

const getSizeCap = ({ name, path, options }: { name: string; path: string; options: Record<string, number> }) => {
	let sized = { cap: options.function, kind: 'function' };

	if (/^use[A-Z]/.test(name)) {
		sized = { cap: options.hook, kind: 'hook' };
	} else if (path.endsWith('.tsx') && /^[A-Z]/.test(name)) {
		sized = { cap: options.component, kind: 'component' };
	}

	return sized;
};

/**
 * A callback nobody named inherits its parent's budget rather than earning one
 * of its own: the parent is the function anyone would split.
 */
const getOversized = ({
	path,
	sourceFile,
	compiler,
	options,
}: {
	path: string;
	sourceFile: ts.SourceFile;
	compiler: typeof ts;
	options: Record<string, number>;
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
const buildFileFindings = ({ input, options }: { input: SyntaxTreeInput; options: Record<string, number> }) => {
	const findings: RawStandardsFinding[] = [];

	for (const [path, sourceFile] of input.trees) {
		const oversized = getOversized({ path, sourceFile, compiler: input.compiler, options });

		if (oversized.length > 0) {
			findings.push(
				buildRawFinding({
					rule: 'function-size',
					files: oversized.map(({ startLine, endLine }) => ({ path, startLine, endLine })),
					detail: oversized.map(({ kind, name, lines, cap }) => `${kind} '${name}' is ${lines} lines (cap ~${cap})`).join('; '),
					guidance:
						'Extract logic. Exempt only when every statement is a call to a named step (or the assignment of its result) and the flow is linear — any inline loop, branch, or transformation disqualifies.',
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

export const check: StandardsCheckModule = {
	inputKind: 'syntax-tree',
	// Measured from the tree rather than counted off the text: the table measures
	// a function from its signature to its closing brace, and only the parse says
	// where either of those is.
	run: ({ input, options }): RawStandardsFinding[] => (input.kind === 'syntax-tree' ? buildFileFindings({ input, options }) : []),
};
