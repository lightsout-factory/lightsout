import { readGitRevParse } from '#src/common/git/readGitRevParse.ts';

interface Params {
	cwd: string;
}

export const readGitHeadCommit = async ({ cwd }: Params): Promise<string | undefined> => readGitRevParse({ cwd, query: 'HEAD' });
