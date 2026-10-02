export const CheckKind = { Deterministic: 'deterministic', Agent: 'agent', Both: 'both' } as const;

export type CheckKind = (typeof CheckKind)[keyof typeof CheckKind];
