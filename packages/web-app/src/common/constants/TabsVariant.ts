export const TabsVariant = { Underline: 'underline', Side: 'side' } as const;

export type TabsVariant = (typeof TabsVariant)[keyof typeof TabsVariant];
