import { z } from 'zod';
import type { StandardsCheckFunction } from '#src/StandardsCheckFunction.ts';
import { StandardsInputKind } from '#src/StandardsInputKind.ts';

const declaredOnce = (kinds: StandardsInputKind[]) => new Set(kinds).size === kinds.length;

// Validated at load time so a mistyped input kind or missing function fails where
// the package is named, not later inside a run.
export const StandardsCheckModule = z
	.object({
		/** Every kind the check cannot run without; the engine builds each and hands all of them to `run`. */
		inputKinds: z.array(z.enum(StandardsInputKind)).min(1).refine(declaredOnce, { message: 'each input kind is declared once' }),
		/**
		 * Kinds the check uses when the engine can build them and runs without
		 * otherwise, such as a syntax tree in a repo with no TypeScript. A kind
		 * the engine could not build is simply absent from `inputs`.
		 */
		optionalInputKinds: z.array(z.enum(StandardsInputKind)).refine(declaredOnce, { message: 'each optional input kind is declared once' }).optional(),
		run: z.custom<StandardsCheckFunction>((value) => typeof value === 'function'),
	})
	.refine(({ inputKinds, optionalInputKinds = [] }) => optionalInputKinds.every((kind) => !inputKinds.includes(kind)), {
		message: 'an input kind is either required or optional, never both',
		path: ['optionalInputKinds'],
	});

export type StandardsCheckModule = z.infer<typeof StandardsCheckModule>;
