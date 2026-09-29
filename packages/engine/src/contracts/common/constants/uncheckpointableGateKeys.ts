/** Gate keys no checkpoint ever schedules, shared by `GateOverride` and `validateGateOverrideNames` so the two cannot drift. */
export const uncheckpointableGateKeys: Record<string, string> = {
	generate: "'generate' is not a checkpoint gate — gates.generate runs before an override's gates automatically, and not at all when the checkpoint is \"off\"",
	format: "'format' is not a checkpoint gate — gates.format runs once at the very end of the pipeline",
};
