/** What a file in a `common/` holds, which decides the folder it goes in. */
export const CodeKind = { Function: 'function', Type: 'type', Constant: 'constant' } as const;

export type CodeKind = (typeof CodeKind)[keyof typeof CodeKind];
