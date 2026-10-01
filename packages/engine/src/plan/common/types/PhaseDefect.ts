import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';

/** A declaration-consistency finding before its check and severity are stamped on. */
export type PhaseDefect = Pick<StructuralFinding, 'phase' | 'issue' | 'location' | 'fix'>;
