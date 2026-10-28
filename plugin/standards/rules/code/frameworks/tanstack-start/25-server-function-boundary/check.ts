import type { RawStandardsFinding, StandardsCheckModule, SyntaxTreeInput } from '@lightsout/standards-contracts';
import type ts from 'typescript';
import { buildRawFinding } from '#common/findings/buildRawFinding.ts';
import { getBaseName } from '#common/paths/getBaseName.ts';
import { getDirectory } from '#common/paths/getDirectory.ts';

const guidance = "Put each server function in its feature's server/ folder, one per file named for what it does.";

/** Whether a folder named `server` sits anywhere above the file. */
const isUnderServerFolder = ({ path }: { path: string }) => getDirectory({ path }).split('/').includes('server');

/** The 1-based lines of every `createServerFn(` call in the file. */
const findServerFunctionLines = ({ sourceFile, compiler }: { sourceFile: ts.SourceFile; compiler: typeof ts }) => {
	const found: number[] = [];

	const visit = (node: ts.Node) => {
		if (compiler.isCallExpression(node) && compiler.isIdentifier(node.expression) && node.expression.text === 'createServerFn') {
			found.push(sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1);
		}

		node.forEachChild(visit);
	};

	visit(sourceFile);

	return found;
};

/** What is wrong with the server functions one file holds, or undefined when it holds one in the right place or none at all. */
const judgeFile = ({ path, lines }: { path: string; lines: number[] }) => {
	if (lines.length === 0) {
		return undefined;
	}

	if (!isUnderServerFolder({ path })) {
		return `'${getBaseName({ path })}' creates a server function outside a server/ folder, at ${lines.length > 1 ? 'lines' : 'line'} ${lines.join(', ')}`;
	}

	return lines.length > 1 ? `'${getBaseName({ path })}' creates ${lines.length} server functions, at lines ${lines.join(', ')}` : undefined;
};

const buildFileFindings = ({ input }: { input: SyntaxTreeInput }) => {
	const findings: RawStandardsFinding[] = [];

	for (const [path, sourceFile] of input.trees) {
		const detail = judgeFile({ path, lines: findServerFunctionLines({ sourceFile, compiler: input.compiler }) });

		if (detail !== undefined) {
			findings.push(buildRawFinding({ rule: 'server-function-boundary', files: [{ path }], detail, guidance }));
		}
	}

	return findings;
};

export const check: StandardsCheckModule = {
	inputKinds: ['syntax-tree'],
	// Where a server function sits and how many a file holds are facts of the
	// tree. Whether one that takes input validates it, and whether a server
	// dependency leaks past server/, are the agent's to judge, which is why the
	// rule has both kinds of check.
	run: ({ inputs }): RawStandardsFinding[] => {
		const input = inputs['syntax-tree'];

		return input === undefined ? [] : buildFileFindings({ input });
	},
};
