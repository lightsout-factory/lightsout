export const SourceKind = { StandardsPack: 'standards-pack', Planning: 'planning' } as const;

export type SourceKind = (typeof SourceKind)[keyof typeof SourceKind];
