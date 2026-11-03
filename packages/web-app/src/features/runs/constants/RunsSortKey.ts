export const RunsSortKey = {
	Status: 'status',
	Title: 'title',
	Command: 'command',
	Steps: 'steps',
	Files: 'files',
	Cost: 'cost',
	Updated: 'updatedAt',
} as const;

export type RunsSortKey = (typeof RunsSortKey)[keyof typeof RunsSortKey];
