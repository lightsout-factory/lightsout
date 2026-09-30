import { hasPermission } from './common/permissions/hasPermission.ts';

export const billing = ({ role }: { role: string }): boolean => hasPermission({ role });
