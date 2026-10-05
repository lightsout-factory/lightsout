/**
 * Required on `runShip` and `runShipAttempt`, so the compiler refuses any shipping
 * path that merges a branch without asking its work order first.
 *
 * The implementation lives in the work-order module, because a `ship` that reached
 * for it would close a cycle in the module graph.
 */
export interface ShipWorkOrderGuard {
	/** Undefined when the branch may ship; otherwise the one sentence saying why it may not. */
	authorize: (params: { cwd: string; branch: string }) => Promise<string | undefined>;
	/** Records a confirmed merge on the branch's ticket record. Never rejects: the merge already happened. */
	recordShipped: (params: { cwd: string; branch: string; mergeCommit: string }) => Promise<void>;
}
