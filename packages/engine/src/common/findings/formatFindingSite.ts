import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';

interface Params {
	file: StandardsFinding['files'][number];
}

export const formatFindingSite = ({ file }: Params): string =>
	`${file.path}${file.startLine ? `:${file.startLine}${file.endLine && file.endLine !== file.startLine ? `-${file.endLine}` : ''}` : ''}`;
