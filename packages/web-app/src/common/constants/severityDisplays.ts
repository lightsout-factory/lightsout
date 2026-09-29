import { StandardsSeverity } from '@lightsout/engine/contracts';
import { type LucideIcon, OctagonX, ToggleLeft, TriangleAlert } from 'lucide-react';

export const severityDisplays: Record<StandardsSeverity, { label: string; verb: string; meaning: string; Icon: LucideIcon; iconClass: string }> = {
	[StandardsSeverity.Blocking]: {
		label: 'Block',
		verb: 'Blocks',
		meaning: 'Stops a run when a file the run changed breaks the rule.',
		Icon: OctagonX,
		iconClass: 'text-status-failed',
	},
	[StandardsSeverity.Advisory]: {
		label: 'Advise',
		verb: 'Advises',
		meaning: 'Reports it and hands it to the refactor agent. Never stops a run.',
		Icon: TriangleAlert,
		iconClass: 'text-status-running',
	},
	[StandardsSeverity.Off]: {
		label: 'Off',
		verb: 'Off',
		meaning: 'Not checked. Use it when your own linter already enforces the rule.',
		Icon: ToggleLeft,
		iconClass: 'text-subtle-foreground',
	},
};
