/**
 * Inside a `common/` these names are mandated, so `banned-folder-name` bans them
 * only elsewhere. A folder directly under `common/` that is NOT one of them is a
 * graduated domain folder, which is what `single-file-domain-folder` judges.
 */
export const commonTypeFolders: ReadonlySet<string> = new Set(['utils', 'types', 'constants', 'services']);
