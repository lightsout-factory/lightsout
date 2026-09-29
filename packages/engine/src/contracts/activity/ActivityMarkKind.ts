/**
 * A closed set rather than free text, because it is the discriminant every
 * reader narrows on: a line whose kind nothing recognises is a line the fold
 * has to drop rather than guess at.
 */
export const ActivityMarkKind = {
	LevelStart: 'level-start',
	LevelEnd: 'level-end',
	HarnessProcess: 'harness-process',
} as const;

export type ActivityMarkKind = (typeof ActivityMarkKind)[keyof typeof ActivityMarkKind];
