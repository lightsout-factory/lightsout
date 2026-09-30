import type { RawStandardsFinding } from '@lightsout/standards-contracts';

interface Params {
	files: RawStandardsFinding['files'];
}

/**
 * A rule reporting several sites per finding must group on exactly what the key
 * is built from, or two groups would collide under a single identity.
 */
export const getSiteGroupKey = ({ files }: Params): string => [...new Set(files.map((file) => file.path))].sort().join('|');
