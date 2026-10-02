/**
 * How a phase is built and proven. Called a build mode rather than a kind
 * because `PlanFileKind` already means a plan file's type. No literal may be
 * shared with `PlanFileKind` or `PlanVariant`: a member of one would compile
 * against the other and silently never equal it.
 */
export const BuildMode = {
	Standard: 'standard',
	RenamesOnly: 'renames-only',
	MoveFoldersAndFiles: 'move-folders-and-files',
} as const;

export type BuildMode = (typeof BuildMode)[keyof typeof BuildMode];
