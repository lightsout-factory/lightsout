// Incorrect: only hasPermission uses this. hasPermission now has a file of its
// own, so it is a module and should leave common/.
export const normalizeRole = ({ role }: { role: string }): string => role.trim().toLowerCase();
