// Correct: only hasPermission uses this, so it lives in hasPermission's common/.
export const normalizeRole = ({ role }: { role: string }): string => role.trim().toLowerCase();
