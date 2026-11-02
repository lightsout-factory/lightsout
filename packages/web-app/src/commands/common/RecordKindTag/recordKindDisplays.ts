import { CommandRecordKind } from '@lightsout/engine/contracts';
import { ClipboardList, FileText, History, type LucideIcon } from 'lucide-react';

/** What a command leaves on disk, in plain words. A command that leaves nothing shows nothing, rather than a tag saying so on most cards. */
export const recordKindDisplays: Record<CommandRecordKind, { label: string; Icon: LucideIcon } | undefined> = {
	[CommandRecordKind.Runs]: { label: 'Saves a run record', Icon: History },
	[CommandRecordKind.Plans]: { label: 'Saves a plan', Icon: FileText },
	[CommandRecordKind.Snapshots]: { label: 'Saves a findings snapshot', Icon: ClipboardList },
	[CommandRecordKind.Nothing]: undefined,
};
