import { createHash } from 'node:crypto';

interface Params {
	content: Buffer | string;
}

export const sha256 = ({ content }: Params): string => createHash('sha256').update(content).digest('hex');
