import { CheckKind } from '#src/constants/CheckKind.ts';

export const checkKindTones: Record<CheckKind, string> = {
	[CheckKind.Deterministic]: 'bg-primary-tint text-primary',
	[CheckKind.Agent]: 'bg-agent-light text-agent-foreground',
};
