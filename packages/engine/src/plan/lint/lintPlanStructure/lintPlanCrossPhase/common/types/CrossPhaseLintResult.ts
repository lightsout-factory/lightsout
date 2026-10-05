import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';

/**
 * `clearedCreates` holds `<phase base>|<path>` keys for create paths an earlier
 * phase provably removes — a legitimate delete-then-recreate the per-file
 * `path-exists` check cannot recognise on its own.
 */
export interface CrossPhaseLintResult {
	findings: StructuralFinding[];
	clearedCreates: Set<string>;
}
