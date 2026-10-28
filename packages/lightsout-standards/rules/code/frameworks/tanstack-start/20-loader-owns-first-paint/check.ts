import type { RawStandardsFinding, StandardsCheckModule, SyntaxTreeInput } from '@lightsout/standards-contracts';
import type ts from 'typescript';
import { buildRawFinding } from '#common/findings/buildRawFinding.ts';
import { isExportedStatement } from '#common/parsing/isExportedStatement.ts';

/** The hooks a query is read through. A hook whose whole body is one of these calls only renames the query. */
const queryHookNames = new Set(['useQuery', 'useSuspenseQuery', 'useInfiniteQuery', 'useSuspenseInfiniteQuery']);

const getQueryHookCalled = ({ expression, compiler }: { expression: ts.Expression; compiler: typeof ts }) =>
	compiler.isCallExpression(expression) && compiler.isIdentifier(expression.expression) && queryHookNames.has(expression.expression.text)
		? expression.expression.text
		: undefined;

/** The query hook a function body does nothing but call: an expression body, or a block holding one `return` of the call. */
const getOnlyQueryHook = ({ body, compiler }: { body: ts.ConciseBody; compiler: typeof ts }) => {
	if (!compiler.isBlock(body)) {
		return getQueryHookCalled({ expression: body, compiler });
	}

	const [statement] = body.statements;

	return body.statements.length === 1 && statement !== undefined && compiler.isReturnStatement(statement) && statement.expression !== undefined
		? getQueryHookCalled({ expression: statement.expression, compiler })
		: undefined;
};

/** Every exported function of the file, with the function it is: a declaration, or an arrow or function expression assigned to a const. */
const getExportedFunctions = ({ sourceFile, compiler }: { sourceFile: ts.SourceFile; compiler: typeof ts }) => {
	const found: Array<{ name: string; body: ts.ConciseBody }> = [];

	for (const statement of sourceFile.statements.filter((candidate) => isExportedStatement({ statement: candidate, compiler }))) {
		if (compiler.isFunctionDeclaration(statement) && statement.name !== undefined && statement.body !== undefined) {
			found.push({ name: statement.name.text, body: statement.body });
		}

		if (compiler.isVariableStatement(statement)) {
			for (const { name, initializer } of statement.declarationList.declarations) {
				if (initializer !== undefined && (compiler.isArrowFunction(initializer) || compiler.isFunctionExpression(initializer)) && compiler.isIdentifier(name)) {
					found.push({ name: name.text, body: initializer.body });
				}
			}
		}
	}

	return found;
};

const buildFileFindings = ({ input }: { input: SyntaxTreeInput }) => {
	const findings: RawStandardsFinding[] = [];

	for (const [path, sourceFile] of input.trees) {
		const wrappers = getExportedFunctions({ sourceFile, compiler: input.compiler }).flatMap(({ name, body }) => {
			const hook = getOnlyQueryHook({ body, compiler: input.compiler });

			return hook === undefined ? [] : [`'${name}' only calls ${hook}`];
		});

		if (wrappers.length > 0) {
			findings.push(
				buildRawFinding({
					rule: 'loader-owns-first-paint',
					files: [{ path }],
					detail: wrappers.join('; '),
					guidance: 'Call the query where it is used, on the options object the loader prefetches, and keep hooks for logic of their own.',
				}),
			);
		}
	}

	return findings;
};

export const check: StandardsCheckModule = {
	inputKinds: ['syntax-tree'],
	// A wrapper hook is a fact of its body, so the code reports it. Whether a
	// screen's first paint waits on data the loader never fetched is the
	// agent's to judge, which is why the rule has both kinds of check.
	run: ({ inputs }): RawStandardsFinding[] => {
		const input = inputs['syntax-tree'];

		return input === undefined ? [] : buildFileFindings({ input });
	},
};
