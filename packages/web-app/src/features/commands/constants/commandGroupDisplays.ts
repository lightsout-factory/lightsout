import { CommandGroup } from '@lightsout/engine/contracts';
import { Flame, Hammer, type LucideIcon, ShieldCheck, Wrench } from 'lucide-react';

/** The heading, one-line purpose and mark each group of commands is shown with, on its section and on every card in it. */
export const commandGroupDisplays: Record<CommandGroup, { label: string; description: string; Icon: LucideIcon }> = {
	[CommandGroup.Build]: { label: 'Build', description: 'Turn an idea into a plan, and a plan into merged, verified code.', Icon: Hammer },
	[CommandGroup.BurnDown]: { label: 'Burn down', description: 'Pay down what is already in the repo, one verified batch at a time.', Icon: Flame },
	[CommandGroup.Standards]: { label: 'Standards', description: 'Check the repo against its standards, and check the standards themselves.', Icon: ShieldCheck },
	[CommandGroup.Housekeeping]: { label: 'Housekeeping', description: 'See what lightsout is doing, what it cost, and what slowed it down.', Icon: Wrench },
};
