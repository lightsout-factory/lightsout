import { CheckKind } from '#src/common/constants/CheckKind.ts';

/** The colours each kind of check wears wherever its icon or tag appears — primary blue for the deterministic ones, the agent's indigo for the rest. */
export const checkKindTones: Record<CheckKind, string> = {
	[CheckKind.Deterministic]: 'bg-primary-tint text-primary',
	[CheckKind.Agent]: 'bg-agent-light text-agent-foreground',
};
