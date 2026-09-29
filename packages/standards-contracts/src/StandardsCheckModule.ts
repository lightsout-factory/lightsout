import { z } from 'zod';
import type { StandardsCheckFunction } from '#src/StandardsCheckFunction.ts';
import { StandardsInputKind } from '#src/StandardsInputKind.ts';

// Validated at load time so a mistyped input kind or missing function fails where
// the package is named, not later inside a run.
export const StandardsCheckModule = z.object({
	inputKind: z.enum(StandardsInputKind),
	run: z.custom<StandardsCheckFunction>((value) => typeof value === 'function'),
});

export type StandardsCheckModule = z.infer<typeof StandardsCheckModule>;
