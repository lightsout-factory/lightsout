import type { SettleKind } from '#src/refactor/batch/internal/common/constants/SettleKind.ts';

export type SettleOutcome = { kind: typeof SettleKind.Green } | { kind: typeof SettleKind.Parked } | { kind: typeof SettleKind.Escalated; error: string };
