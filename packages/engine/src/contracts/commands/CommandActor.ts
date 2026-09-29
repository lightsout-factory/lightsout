export const CommandActor = { Engine: 'the engine', Agent: 'the agent', You: 'you decide' } as const;

export type CommandActor = (typeof CommandActor)[keyof typeof CommandActor];
