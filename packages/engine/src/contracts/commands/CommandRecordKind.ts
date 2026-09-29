export const CommandRecordKind = {
	Runs: 'runs',
	Plans: 'plans',
	Snapshots: 'snapshots',
	Nothing: 'nothing',
} as const;

export type CommandRecordKind = (typeof CommandRecordKind)[keyof typeof CommandRecordKind];
