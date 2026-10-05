import type { GateOutcome } from '#src/gates/runGates/common/types/GateOutcome.ts';

export type RunGate = (params: { kind: string; command: string; group: string }) => Promise<GateOutcome>;
