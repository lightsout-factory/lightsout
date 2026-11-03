export const SceneStatus = { Working: 'working', Over: 'over', Fixing: 'fixing', Clean: 'clean' } as const;

export type SceneStatus = (typeof SceneStatus)[keyof typeof SceneStatus];
