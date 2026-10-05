import type { GateOverride } from '#src/contracts/GateOverride.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';

interface Params {
	overrides: LightsoutConfig['gate-overrides'];
	/** The verification checkpoint in flight: 'clean-slate', 'verify-implement', 'verify-tests' or 'verify-refactor'. */
	checkpoint: string;
}

/**
 * Walks the block's literal keys rather than indexing with the checkpoint: a
 * cast to index a fixed shape by an arbitrary string would accept a checkpoint
 * name nothing declares.
 */
export const resolveGateOverride = ({ overrides, checkpoint }: Params): GateOverride | undefined =>
	Object.entries(overrides ?? {}).find(([key]) => key === checkpoint)?.[1];
