import type { StandardsCheckModule } from '@lightsout/standards-contracts';
import type ts from 'typescript';
import { buildTreeLineCheck } from '#common/checks/buildTreeLineCheck.ts';

const findDocumentedParamsLines = ({ sourceFile, compiler }: { sourceFile: ts.SourceFile; compiler: typeof ts }) => {
	const text = sourceFile.getFullText();
	const found: number[] = [];

	for (const statement of sourceFile.statements) {
		if (!compiler.isInterfaceDeclaration(statement) || statement.name.text !== 'Params') {
			continue;
		}

		const comments = compiler.getLeadingCommentRanges(text, statement.getFullStart()) ?? [];

		if (comments.some(({ pos }) => text.startsWith('/**', pos))) {
			found.push(sourceFile.getLineAndCharacterOfPosition(statement.getStart()).line + 1);
		}
	}

	return found;
};

export const check: StandardsCheckModule = buildTreeLineCheck({
	rule: 'params-interface-docs',
	findLines: findDocumentedParamsLines,
	detail: ({ lines }) => `a doc comment on the \`Params\` interface at ${lines.length > 1 ? 'lines' : 'line'} ${lines.join(', ')}`,
	guidance: "Delete the doc comment: the function's `@param` tags say what each argument is for.",
});
