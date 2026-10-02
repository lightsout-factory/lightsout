import type {
	CloneSpansInput,
	FileListInput,
	FileTextInput,
	ImportGraphInput,
	SyntaxTreeInput,
	TestFileInput,
	TypeCheckerInput,
} from '#src/StandardsCheckInput.ts';
import type { StandardsInputKind } from '#src/StandardsInputKind.ts';

/**
 * What a check is handed, keyed by input kind: an entry for every kind the
 * check declared, and none for any other. Each key is optional in the type
 * because the type cannot say which kinds a given check declared; a check
 * reads the kinds it declared and answers nothing when one is missing.
 */
export interface StandardsCheckInputs {
	[StandardsInputKind.FileList]?: FileListInput;
	[StandardsInputKind.FileText]?: FileTextInput;
	[StandardsInputKind.SyntaxTree]?: SyntaxTreeInput;
	[StandardsInputKind.TypeChecker]?: TypeCheckerInput;
	[StandardsInputKind.TestFile]?: TestFileInput;
	[StandardsInputKind.ImportGraph]?: ImportGraphInput;
	[StandardsInputKind.CloneSpans]?: CloneSpansInput;
}
