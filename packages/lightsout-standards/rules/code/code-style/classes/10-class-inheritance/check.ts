import type { RawStandardsFinding, StandardsCheckModule } from '@lightsout/standards-contracts';
import type ts from 'typescript';
import { buildClassFindings } from '#common/findings/buildClassFindings.ts';

/** The last segment, because it carries the error-family convention the exemption reads. */
const getBaseName = ({ expression, compiler }: { expression: ts.Expression; compiler: typeof ts }): string => {
	if (compiler.isIdentifier(expression)) {
		return expression.text;
	}

	if (compiler.isPropertyAccessExpression(expression)) {
		return expression.name.text;
	}

	if (compiler.isExpressionWithTypeArguments(expression)) {
		return getBaseName({ expression: expression.expression, compiler });
	}

	return expression.getText();
};

/**
 * `implements` is a contract, not inheritance, so only the `extends` clause is
 * read. The Error family is the one base a class may extend, and a decorated
 * class is framework-owned. Whether an undecorated class extends a framework's
 * own base class is the agent's to judge, which is why the rule has both kinds
 * of check.
 */
const getBannedExtension = ({ node, compiler }: { node: ts.ClassDeclaration; compiler: typeof ts }) => {
	const isFrameworkOwned = (node.modifiers ?? []).some((modifier) => compiler.isDecorator(modifier));
	const extended = (node.heritageClauses ?? []).find((clause) => clause.token === compiler.SyntaxKind.ExtendsKeyword)?.types[0];

	if (isFrameworkOwned || extended === undefined) {
		return undefined;
	}

	const base = getBaseName({ expression: extended.expression, compiler });

	if (base === 'Error' || base.endsWith('Error')) {
		return undefined;
	}

	const name = node.name === undefined ? '(anonymous)' : node.name.text;

	return `class '${name}' extends '${base}'`;
};

export const check: StandardsCheckModule = {
	inputKinds: ['syntax-tree'],
	run: ({ inputs }): RawStandardsFinding[] => {
		const input = inputs['syntax-tree'];

		return input === undefined
			? []
			: buildClassFindings({
					input,
					rule: 'class-inheritance',
					guidance:
						'Share by composition: hold the common part as a value and delegate to it, or state the contract as an interface. Only `Error`, or a base class a framework requires, may be extended.',
					getViolation: getBannedExtension,
				});
	},
};
