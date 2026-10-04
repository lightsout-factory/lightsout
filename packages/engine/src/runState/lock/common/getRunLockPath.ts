import { join } from 'node:path';

interface Params {
	cwd: string;
}

export const getRunLockPath = ({ cwd }: Params): string => {
	return join(cwd, '.lightsout', 'lock.json');
};
