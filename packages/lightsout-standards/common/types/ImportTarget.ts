import type { ImportTargetKind } from '../constants/ImportTargetKind.ts';
/**
 * Three answers rather than "a path or nothing", because the two ways of
 * naming no file in scope are different facts and the rules that ask need to
 * tell them apart. `external` is a published package or a builtin: there is no
 * local file and there never was. `unknown` is a specifier that could name a
 * local file, where the mapping needed to say which one was not available —
 * an alias whose tsconfig the run never listed, or one inherited through an
 * `extends` chain this package does not follow.
 */
export type ImportTarget =
	| { kind: typeof ImportTargetKind.File; path: string }
	| { kind: typeof ImportTargetKind.External }
	| { kind: typeof ImportTargetKind.Unknown };
