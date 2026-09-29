import { normalizeRole } from './normalizeRole.ts';

export const hasPermission = ({ role }: { role: string }): boolean => normalizeRole({ role }) === 'admin';
