export const QueryKey = {
	Runs: 'runs',
	Run: 'run',
	Standards: 'standards',
	Plan: 'plan',
	RepoRoot: 'repoRoot',
	DefaultPack: 'defaultPack',
	DefaultPackRule: 'defaultPackRule',
	Commands: 'commands',
	PlanWorkspaces: 'planWorkspaces',
	PlanWorkspace: 'planWorkspace',
	Friction: 'friction',
	Config: 'config',
} as const;

export type QueryKey = (typeof QueryKey)[keyof typeof QueryKey];
