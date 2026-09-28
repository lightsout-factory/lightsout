import { normalizeRole } from './common/utils/normalizeRole.ts';

// Correct: a module of its own next to src/common/, because it has a file that
// only it uses.
export const hasPermission = ({ role }: { role: string }): boolean => normalizeRole({ role }) === 'admin';
