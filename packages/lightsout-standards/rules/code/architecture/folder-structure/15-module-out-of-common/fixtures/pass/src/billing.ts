import { hasPermission } from './hasPermission/hasPermission.ts';

export const billing = ({ role }: { role: string }): boolean => hasPermission({ role });
