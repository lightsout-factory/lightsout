import { Bot, Code, type LucideIcon } from 'lucide-react';
import { CheckKind } from '#src/common/constants/CheckKind.ts';

export const checkKindIcons: Record<CheckKind, LucideIcon> = {
	[CheckKind.Deterministic]: Code,
	[CheckKind.Agent]: Bot,
};
