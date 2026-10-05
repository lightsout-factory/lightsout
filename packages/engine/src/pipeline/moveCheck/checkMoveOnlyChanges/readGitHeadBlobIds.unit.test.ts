import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expect, test } from '@jest/globals';
import { readGitHeadBlobIds } from '#src/pipeline/moveCheck/checkMoveOnlyChanges/readGitHeadBlobIds.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';

/**
 * Two directories side by side: one outside any worktree, and a consumer
 * nested at `apps/api` inside a larger repo whose root and sibling package
 * also track files. After the commit the nested consumer gains an untracked
 * file and an edit to a tracked one, so neither the working tree nor anything
 * outside the subtree can stand in for what `HEAD` holds there. Each source
 * exports nothing, so no consumer file is planted beside it and the tracked set
 * is exactly what the setup names. The expected ids are read from git directly,
 * by repo-root-relative path.
 */
const setupOutsideAndNested = () => {
	const nestedSources = ['apps/api/src/handler.ts', 'apps/api/src/deep/route.ts', 'apps/api/README.md'];
	const outside = setupConsumerRepo({ git: false, sources: { 'src/index.ts': "console.log('outside');\n" } });
	const root = setupConsumerRepo({
		sources: Object.fromEntries(['src/root.ts', 'apps/web/src/page.ts', ...nestedSources].map((path) => [path, `console.log('${path}');\n`])),
	});
	const headIds = Object.fromEntries(
		nestedSources.map((path) => [path, execFileSync('git', ['rev-parse', `HEAD:${path}`], { cwd: root, encoding: 'utf8' }).trim()]),
	);

	mkdirSync(dirname(join(root, 'apps/api/src/untracked.ts')), { recursive: true });
	writeFileSync(join(root, 'apps/api/src/untracked.ts'), "console.log('untracked');\n");
	writeFileSync(join(root, 'apps/api/src/handler.ts'), "console.log('edited after the commit');\n");

	return { outsideCwd: outside, nestedCwd: join(root, 'apps', 'api'), headIds };
};

test('readGitHeadBlobIds: maps each tracked path under the working directory to its HEAD blob id', async () => {
	const { outsideCwd, nestedCwd, headIds } = setupOutsideAndNested();

	const [outside, nested] = await Promise.all([readGitHeadBlobIds({ cwd: outsideCwd }), readGitHeadBlobIds({ cwd: nestedCwd })]);

	// no worktree means no git truth; inside one, only the subtree under the
	// working directory is listed, its paths carry no `apps/api/` prefix, the
	// untracked file is absent and the edited file keeps its committed id
	expect({ outside, nested: nested && Object.fromEntries([...nested].sort(([a], [b]) => a.localeCompare(b))) }).toStrictEqual({
		outside: undefined,
		nested: {
			'README.md': headIds['apps/api/README.md'],
			'src/deep/route.ts': headIds['apps/api/src/deep/route.ts'],
			'src/handler.ts': headIds['apps/api/src/handler.ts'],
		},
	});
});

/**
 * A committed repo whose tree also holds a submodule's gitlink at
 * `vendor/lib`, recorded straight into the index so no submodule is cloned.
 * The expected id of `src/index.ts` is read from git directly.
 */
const setupGitlinkRepo = () => {
	const cwd = setupConsumerRepo({ sources: { 'src/index.ts': "console.log('index');\n" } });
	const commitId = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();

	execFileSync('git', ['update-index', '--add', '--cacheinfo', `160000,${commitId},vendor/lib`], { cwd });
	execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'gitlink'], { cwd });

	return { cwd, indexId: execFileSync('git', ['rev-parse', 'HEAD:src/index.ts'], { cwd, encoding: 'utf8' }).trim() };
};

test('readGitHeadBlobIds: leaves out a submodule, whose tree entry is a commit rather than a blob', async () => {
	const { cwd, indexId } = setupGitlinkRepo();

	const blobIds = await readGitHeadBlobIds({ cwd });

	expect({ carriesGitlink: blobIds?.has('vendor/lib'), indexId: blobIds?.get('src/index.ts') }).toStrictEqual({ carriesGitlink: false, indexId });
});
