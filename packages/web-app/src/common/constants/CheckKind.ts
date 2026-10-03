export const CheckKind = { Deterministic: 'deterministic', Agent: 'agent' } as const;

export type CheckKind = (typeof CheckKind)[keyof typeof CheckKind];
