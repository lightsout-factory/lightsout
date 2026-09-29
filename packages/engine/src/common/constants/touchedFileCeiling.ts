/**
 * Touched means every source file the plan names under any file heading —
 * created, modified or moved. Neither `executor-file-limit` nor a plan's
 * `## File Budget` raises it. A rename-only plan or phase is exempt: its size
 * is not what makes it hard.
 */
export const touchedFileCeiling = 70;
