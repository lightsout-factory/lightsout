import { StandardsSeverity } from '@lightsout/engine/contracts';
import { BadgeVariant } from '#src/common/constants/BadgeVariant.ts';

export const severityBadgeVariants: Record<StandardsSeverity, BadgeVariant> = {
	[StandardsSeverity.Blocking]: BadgeVariant.Blocking,
	[StandardsSeverity.Advisory]: BadgeVariant.Advisory,
	[StandardsSeverity.Off]: BadgeVariant.Neutral,
};
