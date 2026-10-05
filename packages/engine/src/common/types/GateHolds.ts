import type { GateHold } from '#src/contracts/gates/GateHold.ts';

/**
 * A plain type rather than a schema in `contracts/`, because nothing parses a
 * document of this shape: what is parsed is one `GateHold` per file. The keys
 * are lowercased because every other identifier comparison in the queue is, and
 * one site spelling it differently would make a hold invisible to that site alone.
 */
export type GateHolds = Record<string, GateHold>;
