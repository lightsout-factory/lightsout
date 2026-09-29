/**
 * Lives here rather than in the `workOrder` module because `ship` and
 * `worktree` need it and are already imported by that module — importing
 * `workOrder` from them would close a module cycle.
 */
export const workOrderStateFileName = 'state.json';
