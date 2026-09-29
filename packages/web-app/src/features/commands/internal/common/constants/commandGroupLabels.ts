import { CommandGroup } from '@lightsout/engine/contracts';

export const commandGroupLabels: Record<CommandGroup, string> = {
	[CommandGroup.Build]: 'Build',
	[CommandGroup.BurnDown]: 'Burn down',
	[CommandGroup.Standards]: 'Standards',
	[CommandGroup.Housekeeping]: 'Housekeeping',
};
