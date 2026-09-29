export const Framework = { TypeScript: 'typescript', React: 'react', TanStack: 'tanstack' } as const;

export type Framework = (typeof Framework)[keyof typeof Framework];
