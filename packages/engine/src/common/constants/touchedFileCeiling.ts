/**
 * Touched means every source file the plan names under any file heading —
 * created, modified or moved — and a folder move counts every file it carries.
 * Neither `executor-file-limit` nor a plan's `## File Budget` raises it. A
 * rename-only plan or phase and a move-folders-and-files plan or phase are both
 * exempt: their size is not what makes them hard.
 */
export const touchedFileCeiling = 70;
