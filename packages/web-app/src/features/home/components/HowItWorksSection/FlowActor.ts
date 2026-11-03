export const FlowActor = { You: 'you', Agent: 'agent' } as const;

export type FlowActor = (typeof FlowActor)[keyof typeof FlowActor];
