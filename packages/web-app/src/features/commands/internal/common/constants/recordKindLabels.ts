import { CommandRecordKind } from '@lightsout/engine/contracts';

export const recordKindLabels: Record<CommandRecordKind, string> = {
	[CommandRecordKind.Runs]: 'records runs',
	[CommandRecordKind.Plans]: 'records plans',
	[CommandRecordKind.Snapshots]: 'records snapshots',
	[CommandRecordKind.Nothing]: 'records nothing',
};
