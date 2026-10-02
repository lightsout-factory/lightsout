import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expect, test } from '@jest/globals';
import { readGitTrackedFiles } from '#src/common/git/readGitTrackedFiles.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';

/**
 * A committed consumer repo plus untracked files. `sources` are committed with
 * the repo — each exports nothing, so no consumer file is planted beside it and
 * the tracked set is exactly what the test names. `untracked` plants files by
 * repo-root-relative path after the commit, and `at` anchors the read at a
 * subdirectory — the nested-consumer case.
 */
const setupTrackedRepo = ({ git = true, sources, untracked = [], at }: { git?: boolean; sources?: string[]; untracked?: string[]; at?: string } = {}) => {
	const root = setupConsumerRepo({
		git,
		sources: sources && Object.fromEntries(sources.map((path) => [path, `console.log('${path}');\n`])),
	});

	for (const path of untracked) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), "console.log('untracked');\n");
	}

	return { cwd: at ? join(root, at) : root };
};

/**
 * Two directories side by side: one outside any worktree, and a consumer
 * nested at `apps/api` inside a larger repo whose root and sibling package
 * also track a `src` folder.
 */
const setupOutsideAndNested = () => {
	const outside = setupTrackedRepo({ git: false, sources: ['src/index.ts'] });
	const nested = setupTrackedRepo({
		sources: ['src/root.ts', 'apps/api/src/handler.ts', 'apps/api/src/deep/route.ts', 'apps/web/src/page.ts'],
		at: join('apps', 'api'),
	});

	return { outsideCwd: outside.cwd, nestedCwd: nested.cwd };
};

const sorted = (paths: string[] | undefined) => (paths === undefined ? undefined : [...paths].sort());

test('readGitTrackedFiles: lists the tracked files under the given folders, read literally, and leaves untracked files and other folders out', async () => {
	const { cwd } = setupTrackedRepo({
		sources: ['src/a/one.ts', 'src/a/deep/two.ts', 'src/b/three.ts', 'app/[slug]/page.ts', 'app/s/other.ts'],
		untracked: ['src/a/untracked.ts'],
	});

	const files = await readGitTrackedFiles({ cwd, folders: ['src/a', 'app/[slug]'] });

	// `app/[slug]` read as a glob would match `app/s`; read literally it does not
	expect(sorted(files)).toStrictEqual(['app/[slug]/page.ts', 'src/a/deep/two.ts', 'src/a/one.ts']);
});

test('readGitTrackedFiles: answers cwd-relative paths from a nested consumer and undefined outside a worktree', async () => {
	const { outsideCwd, nestedCwd } = setupOutsideAndNested();

	const [outside, nested] = await Promise.all([
		readGitTrackedFiles({ cwd: outsideCwd, folders: ['src'] }),
		readGitTrackedFiles({ cwd: nestedCwd, folders: ['src'] }),
	]);

	// no worktree means no git truth; inside one, `src` is the consumer's own
	// folder and its paths carry no `apps/api/` prefix
	expect({ outside, nested: sorted(nested) }).toStrictEqual({
		outside: undefined,
		nested: ['src/deep/route.ts', 'src/handler.ts'],
	});
});

test('readGitTrackedFiles: a directory that does not exist reports undefined rather than raising the spawn failure', async () => {
	const files = await readGitTrackedFiles({ cwd: '/lightsout/no/such/directory', folders: ['src'] });

	expect(files).toBe(undefined);
});
