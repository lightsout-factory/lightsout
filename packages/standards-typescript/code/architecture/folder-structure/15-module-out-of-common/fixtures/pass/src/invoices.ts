import { hasPermission } from './hasPermission/hasPermission.ts';

export const invoices = ({ role }: { role: string }): boolean => hasPermission({ role });
