import { StandardsInputKind } from '@lightsout/standards-contracts';

/**
 * The engine borrows the consumer's compiler rather than bundling its own, so a
 * JS-only repo has none, and rules that ask for these inputs sit the run out
 * with a note.
 */
export const typescriptInputKinds: ReadonlySet<StandardsInputKind> = new Set([
	StandardsInputKind.SyntaxTree,
	StandardsInputKind.TypeChecker,
	StandardsInputKind.ImportGraph,
]);
