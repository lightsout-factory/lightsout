import type { RawStandardsFinding, StandardsCheckModule, SyntaxTreeInput, TypeCheckerInput } from '@lightsout/standards-contracts';
import type ts from 'typescript';
import { buildRawFinding } from '#common/findings/buildRawFinding.ts';
import { getOwningPack } from '#common/paths/getOwningPack.ts';

const lineOf = ({ sourceFile, node }: { sourceFile: ts.SourceFile; node: ts.Node }) => sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;

const isStringLiteralUnion = ({ node, compiler }: { node: ts.TypeAliasDeclaration; compiler: typeof ts }) =>
	compiler.isUnionTypeNode(node.type) &&
	node.type.types.length > 1 &&
	node.type.types.every((member) => compiler.isLiteralTypeNode(member) && compiler.isStringLiteral(member.literal));

const isExported = ({ node, compiler }: { node: ts.TypeAliasDeclaration; compiler: typeof ts }) =>
	(node.modifiers ?? []).some((modifier) => modifier.kind === compiler.SyntaxKind.ExportKeyword);

const isConstDeclaration = ({ statement, compiler }: { statement: ts.Statement; compiler: typeof ts }) =>
	compiler.isVariableStatement(statement) && (statement.declarationList.flags & compiler.NodeFlags.Const) !== 0;

const getConstNames = ({ sourceFile, compiler }: { sourceFile: ts.SourceFile; compiler: typeof ts }) =>
	new Set(
		sourceFile.statements
			.filter((statement) => isConstDeclaration({ statement, compiler }))
			.flatMap((statement) => (compiler.isVariableStatement(statement) ? statement.declarationList.declarations : []))
			.flatMap((declaration) => (compiler.isIdentifier(declaration.name) ? [declaration.name.text] : [])),
	);

/**
 * With a `const` object of the same name the union is derived from it and
 * consumers dot into the object; with only the type, every call site retypes
 * the literal. A union of literals and a union derived from a `const` object
 * are the same type by the time anything else can see them; only the
 * declaration says which one was written.
 */
const getBareUnions = ({ sourceFile, compiler }: { sourceFile: ts.SourceFile; compiler: typeof ts }) => {
	const constNames = getConstNames({ sourceFile, compiler });

	return sourceFile.statements
		.filter((statement) => compiler.isTypeAliasDeclaration(statement))
		.filter((node) => isExported({ node, compiler }) && isStringLiteralUnion({ node, compiler }))
		.map((statement) => statement.name.text)
		.filter((name) => !constNames.has(name));
};

/** One finding per file: the remedy is to write the `const` object and derive the union from it, which is one edit to that file. */
const findBareUnions = ({ input }: { input: SyntaxTreeInput | undefined }): RawStandardsFinding[] =>
	input === undefined
		? []
		: [...input.trees].flatMap(([path, tree]) => {
				const bare = getBareUnions({ sourceFile: tree, compiler: input.compiler });

				return bare.length === 0
					? []
					: [
							buildRawFinding({
								rule: 'named-string-values',
								files: [{ path }],
								detail: bare.map((name) => `type '${name}' is a bare string union`).join('; '),
								guidance: 'Declare the values as an `as const` object and derive the union from it, so consumers reference members instead of literals.',
							}),
						];
			});

/**
 * Without the const objects the checker alone would call any literal union a
 * family, and report every `typeof value === 'string'` guard in the repo. The
 * declaring paths are kept because a site can only reference an object it is
 * allowed to import.
 */
const readConstStrings = ({ typedFiles, compiler }: { typedFiles: TypeCheckerInput['typedFiles']; compiler: typeof ts }) => {
	const strings = new Map<string, Set<string>>();

	for (const [declaringPath, { sourceFile }] of typedFiles) {
		const visit = (node: ts.Node) => {
			if (compiler.isVariableDeclaration(node) && node.initializer !== undefined) {
				const init = node.initializer;
				const frozen = compiler.isAsExpression(init) && compiler.isTypeReferenceNode(init.type) && init.type.typeName.getText() === 'const';

				if (frozen && compiler.isObjectLiteralExpression(init.expression)) {
					for (const property of init.expression.properties) {
						if (compiler.isPropertyAssignment(property) && compiler.isStringLiteral(property.initializer)) {
							const value = property.initializer.text;

							strings.set(value, new Set([...(strings.get(value) ?? []), declaringPath]));
						}
					}
				}
			}

			node.forEachChild(visit);
		};

		visit(sourceFile);
	}

	return strings;
};

const declarationLines = ({ sourceFile, compiler }: { sourceFile: ts.SourceFile; compiler: typeof ts }) => {
	const lines: number[] = [];
	const visit = (node: ts.Node) => {
		if (compiler.isPropertySignature(node) && node.type !== undefined && compiler.isLiteralTypeNode(node.type) && compiler.isStringLiteral(node.type.literal)) {
			lines.push(lineOf({ sourceFile, node }));
		}

		node.forEachChild(visit);
	};

	visit(sourceFile);

	return lines;
};

/**
 * Only a checker can answer this: the expression's DECLARED type says whether a
 * literal is a discriminant, and that declaration is almost never in the file
 * doing the comparing. Every part has to be a literal: a union of a literal
 * and `string` widens to `string` for narrowing purposes, and calling that a
 * family would flag an ordinary string comparison that happens to match one member.
 */
const readFamily = ({ node, checker }: { node: ts.Expression; checker: ts.TypeChecker }) => {
	const type = checker.getTypeAtLocation(node);
	const parts = type.isUnion() ? type.types : [type];
	const members = parts.filter((part) => part.isStringLiteral()).map((part) => part.value);

	return members.length === 0 || members.length !== parts.length
		? undefined
		: { name: type.aliasSymbol?.getName() ?? checker.typeToString(type), members: new Set(members) };
};

interface NarrowingParams {
	typed: { sourceFile: ts.SourceFile; checker: ts.TypeChecker };
	compiler: typeof ts;
	constStrings: Map<string, Set<string>>;
	reachable: (params: { declaringPath: string }) => boolean;
}

/**
 * `===` and `switch` both count: a rule that saw only the first would send an
 * agent to fix an `if` and walk past the switch beneath it.
 */
const narrowingSites = ({ typed: { sourceFile, checker }, compiler, constStrings, reachable }: NarrowingParams) => {
	const sites: Array<{ line: number; family: string }> = [];
	const record = ({ node, subject, literal }: { node: ts.Node; subject: ts.Expression; literal: ts.StringLiteral }) => {
		// `typeof value === 'string'` types as the operator's own eight-member
		// union. It is a type guard, not a family a const object stands behind.
		const declaredIn = compiler.isTypeOfExpression(subject) ? undefined : constStrings.get(literal.text);

		if (declaredIn === undefined || ![...declaredIn].some((declaringPath) => reachable({ declaringPath }))) {
			return;
		}

		const family = readFamily({ node: subject, checker });

		if (family?.members.has(literal.text)) {
			sites.push({ line: lineOf({ sourceFile, node }), family: family.name });
		}
	};
	const visit = (node: ts.Node) => {
		if (compiler.isBinaryExpression(node)) {
			const equality =
				node.operatorToken.kind === compiler.SyntaxKind.EqualsEqualsEqualsToken || node.operatorToken.kind === compiler.SyntaxKind.ExclamationEqualsEqualsToken;
			const literal = [node.left, node.right].find((side) => compiler.isStringLiteral(side));
			const subject = literal === node.left ? node.right : node.left;

			if (equality && literal !== undefined && compiler.isStringLiteral(literal)) {
				record({ node, subject, literal });
			}
		}

		// A case clause is the same narrowing spelled the other way. The switch it
		// belongs to is two nodes up — clause, block, statement.
		if (compiler.isCaseClause(node) && compiler.isStringLiteral(node.expression)) {
			const statement = node.parent?.parent;

			if (statement !== undefined && compiler.isSwitchStatement(statement)) {
				record({ node, subject: statement.expression, literal: node.expression });
			}
		}

		node.forEachChild(visit);
	};

	visit(sourceFile);

	return sites;
};

const formatLineList = ({ lines }: { lines: number[] }) => `at ${lines.length > 1 ? 'lines' : 'line'} ${lines.join(', ')}`;

/**
 * Reported on source only; `typedFiles` also carries tests and out-of-scope
 * files because the evidence needs them typed. A discriminant declared in
 * another pack is one a check may not import, so its literal is not a finding.
 */
const findLiteralDiscriminants = ({ input }: { input: TypeCheckerInput | undefined }): RawStandardsFinding[] => {
	if (input === undefined) {
		return [];
	}

	const constStrings = readConstStrings({ typedFiles: input.typedFiles, compiler: input.compiler });

	return input.source.flatMap((path) => {
		const typed = input.typedFiles.get(path);

		if (typed === undefined) {
			return [];
		}

		const home = getOwningPack({ path, standardsLibraries: input.standardsLibraries });
		const declarations = declarationLines({ sourceFile: typed.sourceFile, compiler: input.compiler });
		const narrowings = narrowingSites({
			typed,
			compiler: input.compiler,
			constStrings,
			reachable: ({ declaringPath }) => home === '.' || getOwningPack({ path: declaringPath, standardsLibraries: input.standardsLibraries }) === home,
		});
		const families = [...new Set(narrowings.map((site) => site.family))];
		const detail = [
			...(declarations.length > 0 ? [`field typed as a raw string literal ${formatLineList({ lines: declarations })}`] : []),
			...(narrowings.length > 0
				? [`${families.join(', ')} narrowed against a raw string literal ${formatLineList({ lines: narrowings.map((site) => site.line) })}`]
				: []),
		].join('; ');

		return detail === ''
			? []
			: [
					buildRawFinding({
						rule: 'named-string-values',
						files: [{ path }],
						detail,
						guidance: "Reference the family's `const` object — `kind: typeof SyncEventKind.FileAdded`, and `SyncEventKind.FileAdded` at every narrowing site.",
					}),
				];
	});
};

export const check: StandardsCheckModule = {
	inputKinds: ['syntax-tree', 'type-checker'],
	/**
	 * The parsed tree shows a bare union, since only the declaration says whether
	 * a `const` object stands behind it. Whether a compared literal is a
	 * discriminant takes the checker: its DECLARED type lives in another file.
	 */
	run: ({ inputs }): RawStandardsFinding[] => [
		...findBareUnions({ input: inputs['syntax-tree'] }),
		...findLiteralDiscriminants({ input: inputs['type-checker'] }),
	],
};
