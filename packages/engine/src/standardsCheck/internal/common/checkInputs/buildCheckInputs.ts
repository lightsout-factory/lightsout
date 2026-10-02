import { type StandardsCheckInput, type StandardsCheckInputs, StandardsInputKind } from '@lightsout/standards-contracts';

interface Params {
	/** The kinds one check declared, each built once by `inputFor`. */
	kinds: StandardsInputKind[];
	inputFor: (params: { kind: StandardsInputKind }) => Promise<StandardsCheckInput>;
}

/** Each kind lands under its own key, so a check reads the shape it declared without narrowing a union. */
const place = ({ inputs, input }: { inputs: StandardsCheckInputs; input: StandardsCheckInput }) => {
	switch (input.kind) {
		case StandardsInputKind.FileList:
			inputs[StandardsInputKind.FileList] = input;
			break;
		case StandardsInputKind.FileText:
			inputs[StandardsInputKind.FileText] = input;
			break;
		case StandardsInputKind.SyntaxTree:
			inputs[StandardsInputKind.SyntaxTree] = input;
			break;
		case StandardsInputKind.TypeChecker:
			inputs[StandardsInputKind.TypeChecker] = input;
			break;
		case StandardsInputKind.TestFile:
			inputs[StandardsInputKind.TestFile] = input;
			break;
		case StandardsInputKind.ImportGraph:
			inputs[StandardsInputKind.ImportGraph] = input;
			break;
		case StandardsInputKind.CloneSpans:
			inputs[StandardsInputKind.CloneSpans] = input;
			break;
	}
};

/** What one check is handed: an input for every kind it declared, and nothing for any other. */
export const buildCheckInputs = async ({ kinds, inputFor }: Params): Promise<StandardsCheckInputs> => {
	const inputs: StandardsCheckInputs = {};

	for (const kind of kinds) {
		place({ inputs, input: await inputFor({ kind }) });
	}

	return inputs;
};
