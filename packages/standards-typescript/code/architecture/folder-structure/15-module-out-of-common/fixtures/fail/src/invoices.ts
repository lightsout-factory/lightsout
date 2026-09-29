import { hasPermission } from './common/permissions/hasPermission.ts';

export const invoices = ({ role }: { role: string }): boolean => hasPermission({ role });
