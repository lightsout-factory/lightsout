import { readGitRevParse } from '#src/common/git/readGitRevParse.ts';

interface Params {
	cwd: string;
}

/** '' at the repo root, e.g. 'fixtures/toy-calc/' when nested, undefined outside any worktree. */
export const readGitPrefix = async ({ cwd }: Params): Promise<string | undefined> => readGitRevParse({ cwd, query: '--show-prefix' });
