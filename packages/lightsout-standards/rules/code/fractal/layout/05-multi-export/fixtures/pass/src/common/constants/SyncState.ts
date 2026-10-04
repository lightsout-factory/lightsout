export const SyncState = { idle: 'idle', busy: 'busy' } as const;

export type SyncState = (typeof SyncState)[keyof typeof SyncState];
