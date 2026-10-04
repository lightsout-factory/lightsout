import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { commitWorkOrderWork } from '#src/commit/commitWorkOrderWork/commitWorkOrderWork.ts';
import { committedPaths } from '#tests/helpers/committedPaths.ts';
import { generatedPaths } from '#tests/helpers/generatedPaths.ts';
import { headSubject } from '#tests/helpers/headSubject.ts';
import { setupTicketBranch } from '#tests/helpers/setupTicketBranch.ts';
import { writeRepoFile } from '#tests/helpers/writeRepoFile.ts';

/**
 * A repo whose own pre-commit hook refuses the commit — staging still succeeds,
 * so this is the one arrangement that reaches the commit step's own refusal
 * rather than the staging step's. The hook lives under `.git/`, where
 * `git add -A` cannot see it, and the path is set in the repo's own config so a
 * machine-wide hooks directory cannot take its place.
 */
const refuseCommits = ({ cwd }: { cwd: string }) => {
	const hooks = join(cwd, '.git', 'refusing-hooks');

	mkdirSync(hooks, { recursive: true });
	writeFileSync(join(hooks, 'pre-commit'), '#!/bin/sh\necho "this repo refuses commits" >&2\nexit 1\n', { mode: 0o755 });
	execSync(`git config core.hooksPath ${hooks}`, { cwd, stdio: 'ignore' });
};

describe('commitWorkOrderWork', () => {
	test('commits everything the worker changed and says it committed, so a caller can tell a commit from a no-op', async () => {
		const { cwd, runDir } = setupTicketBranch();

		writeRepoFile({ cwd, path: 'src.ts', content: 'export const value = 1;\n' });

		const committed = await commitWorkOrderWork({ cwd, composeMessage: async () => 'LO-70 Drain the backlog', runDir });

		expect(committed).toStrictEqual({ committed: true, message: 'LO-70 Drain the backlog' });
		expect(headSubject({ cwd })).toBe('LO-70 Drain the backlog');
	});

	test('reports a tree the worker never touched rather than making an empty commit', async () => {
		const { cwd, runDir } = setupTicketBranch();

		expect(await commitWorkOrderWork({ cwd, composeMessage: async () => 'LO-70 nothing', runDir })).toStrictEqual({ committed: false });
	});

	test('refuses a tree git cannot read, because a commit cannot be promised over one', async () => {
		const committed = await commitWorkOrderWork({
			cwd: '/lightsout/no/such/directory',
			composeMessage: async () => 'LO-70 nowhere',
			runDir: '/lightsout/no/such/directory/.lightsout',
		});

		expect(committed).toStrictEqual({ error: 'git could not read the tree at /lightsout/no/such/directory' });
	});

	test('reports what git refused rather than claiming a commit, when the work cannot be staged', async () => {
		const { cwd, runDir } = setupTicketBranch();

		writeRepoFile({ cwd, path: 'src.ts', content: 'export const value = 1;\n' });
		// An index git will not let go of is the simplest way to make staging fail
		// while the tree still reads as changed.
		writeFileSync(join(cwd, '.git', 'index.lock'), '');

		const committed = await commitWorkOrderWork({ cwd, composeMessage: async () => 'LO-70 blocked', runDir });

		expect(committed).toEqual({ error: expect.stringContaining(`git could not stage the work in ${cwd}`) });
	});

	test('reports what git refused rather than claiming a commit, when staging works and the commit itself is refused', async () => {
		const { cwd, runDir } = setupTicketBranch();

		writeRepoFile({ cwd, path: 'src.ts', content: 'export const value = 1;\n' });
		refuseCommits({ cwd });

		const committed = await commitWorkOrderWork({ cwd, composeMessage: async () => 'LO-70 refused', runDir });

		// the two refusals must never read as one: staged-but-uncommitted is a
		// different thing for a human to fix than nothing staged at all
		expect(committed).toEqual({ error: expect.stringContaining(`git could not commit the work in ${cwd}`) });
		// and the branch is left standing where it was, with no commit claimed
		expect(headSubject({ cwd })).toBe('ignore');
	});

	test('leaves a generated file out of the commit, so the branch carries source only', async () => {
		const { cwd, runDir } = setupTicketBranch();

		writeRepoFile({ cwd, path: 'src.ts', content: 'export const value = 1;\n' });
		writeRepoFile({ cwd, path: 'plugin/dist/chunk.mjs', content: '// built on the branch\n' });

		const committed = await commitWorkOrderWork({ cwd, composeMessage: async () => 'LO-79 source only', runDir, generated: generatedPaths });

		expect(committed).toStrictEqual({ committed: true, message: 'LO-79 source only' });
		expect(committedPaths({ cwd })).toStrictEqual(['src.ts']);
	});

	test('restores a tracked generated file the worker rewrote, so the branch carries no stale build output', async () => {
		const { cwd, runDir } = setupTicketBranch();

		writeRepoFile({ cwd, path: 'src.ts', content: 'export const value = 1;\n' });
		writeRepoFile({ cwd, path: 'plugin/dist/cli.mjs', content: '// rebuilt on the branch\n' });

		const committed = await commitWorkOrderWork({ cwd, composeMessage: async () => 'LO-79 no stale output', runDir, generated: generatedPaths });

		expect(committed).toStrictEqual({ committed: true, message: 'LO-79 no stale output' });
		expect(readFileSync(join(cwd, 'plugin', 'dist', 'cli.mjs'), 'utf8')).toBe('// built on main\n');
		expect(committedPaths({ cwd })).toStrictEqual(['src.ts']);
	});

	test('reports nothing to commit when the only change was generated output', async () => {
		const { cwd, runDir } = setupTicketBranch();

		writeRepoFile({ cwd, path: 'plugin/dist/chunk.mjs', content: '// built on the branch\n' });

		const committed = await commitWorkOrderWork({ cwd, composeMessage: async () => 'LO-79 build only', runDir, generated: generatedPaths });

		expect(committed).toStrictEqual({ committed: false });
		expect(headSubject({ cwd })).toBe('ignore');
	});

	test("leaves the working tree clean, so the ship step's dirty-tree check still passes", async () => {
		const { cwd, runDir } = setupTicketBranch();

		writeRepoFile({ cwd, path: 'plugin/dist/chunk.mjs', content: '// built on the branch\n' });

		await commitWorkOrderWork({ cwd, composeMessage: async () => 'LO-79 build only', runDir, generated: generatedPaths });

		expect(execSync('git status --porcelain', { cwd }).toString()).toBe('');
	});

	test("commits generated paths when the repo configures none, which is exactly today's behaviour", async () => {
		const { cwd, runDir } = setupTicketBranch();

		writeRepoFile({ cwd, path: 'plugin/dist/chunk.mjs', content: '// built on the branch\n' });

		const committed = await commitWorkOrderWork({ cwd, composeMessage: async () => 'LO-79 no generated configured', runDir });

		expect(committed).toStrictEqual({ committed: true, message: 'LO-79 no generated configured' });
		expect(committedPaths({ cwd })).toStrictEqual(['plugin/dist/chunk.mjs']);
	});

	test('commits a vendored file the worker edited, because a vendored edit is the change itself', async () => {
		const { cwd, runDir } = setupTicketBranch();

		writeRepoFile({
			cwd,
			path: 'packages/web-app/src/common/components/ui/button.tsx',
			content: 'export const Button = () => null;\n',
		});

		const committed = await commitWorkOrderWork({ cwd, composeMessage: async () => 'LO-79 vendored edit', runDir, generated: generatedPaths });

		expect(committed).toStrictEqual({ committed: true, message: 'LO-79 vendored edit' });
		expect(committedPaths({ cwd })).toStrictEqual(['packages/web-app/src/common/components/ui/button.tsx']);
	});

	test('discards a configured single file as well as a configured directory prefix', async () => {
		const { cwd, runDir } = setupTicketBranch();

		writeRepoFile({ cwd, path: 'src.ts', content: 'export const value = 1;\n' });
		writeRepoFile({ cwd, path: 'plugin/dist/chunk.mjs', content: '// built on the branch\n' });
		writeRepoFile({ cwd, path: 'packages/web-app/src/routeTree.gen.ts', content: 'export const routeTree = 1;\n' });

		const committed = await commitWorkOrderWork({ cwd, composeMessage: async () => 'LO-79 both shapes', runDir, generated: generatedPaths });

		expect(committed).toStrictEqual({ committed: true, message: 'LO-79 both shapes' });
		expect(committedPaths({ cwd })).toStrictEqual(['src.ts']);
	});

	test('discards a generated path whose name carries glob characters', async () => {
		const { cwd, runDir } = setupTicketBranch();

		writeRepoFile({ cwd, path: 'src.ts', content: 'export const value = 1;\n' });
		writeRepoFile({ cwd, path: 'plugin/dist/[slug].mjs', content: '// built on the branch\n' });

		const committed = await commitWorkOrderWork({ cwd, composeMessage: async () => 'LO-79 glob name', runDir, generated: generatedPaths });

		expect(committed).toStrictEqual({ committed: true, message: 'LO-79 glob name' });
		expect(committedPaths({ cwd })).toStrictEqual(['src.ts']);
		expect(existsSync(join(cwd, 'plugin', 'dist', '[slug].mjs'))).toBe(false);
	});

	test('says how many generated paths it discarded, so an unattended run records why the branch carries no build output', async () => {
		const { cwd, runDir } = setupTicketBranch();
		const lines: string[] = [];

		writeRepoFile({ cwd, path: 'src.ts', content: 'export const value = 1;\n' });
		writeRepoFile({ cwd, path: 'plugin/dist/chunk.mjs', content: '// built on the branch\n' });
		writeRepoFile({ cwd, path: 'packages/web-app/src/routeTree.gen.ts', content: 'export const routeTree = 1;\n' });

		await commitWorkOrderWork({
			cwd,
			composeMessage: async () => 'LO-79 says what it discarded',
			runDir,
			generated: generatedPaths,
			onProgress: (message) => lines.push(message),
		});

		expect(lines).toEqual(expect.arrayContaining([expect.stringContaining('discarded 2 generated path(s)')]));
	});

	test('reports what git refused rather than claiming a commit, when the generated changes cannot be discarded', async () => {
		const { cwd, runDir } = setupTicketBranch();

		writeRepoFile({ cwd, path: 'plugin/dist/cli.mjs', content: '// rebuilt on the branch\n' });
		// An index git will not let go of is the simplest way to make the discard
		// fail while the tree still reads as changed.
		writeFileSync(join(cwd, '.git', 'index.lock'), '');

		const committed = await commitWorkOrderWork({ cwd, composeMessage: async () => 'LO-79 discard blocked', runDir, generated: generatedPaths });

		expect(committed).toEqual({ error: expect.stringContaining(`git could not discard the generated changes in ${cwd}`) });
	});

	test('commits a source file whose name merely begins with a configured generated entry', async () => {
		const { cwd, runDir } = setupTicketBranch();

		writeRepoFile({ cwd, path: 'plugin/distortion.ts', content: 'export const distort = () => null;\n' });

		const committed = await commitWorkOrderWork({ cwd, composeMessage: async () => 'LO-79 segment boundary', runDir, generated: generatedPaths });

		expect(committed).toStrictEqual({ committed: true, message: 'LO-79 segment boundary' });
		expect(committedPaths({ cwd })).toStrictEqual(['plugin/distortion.ts']);
	});

	test('discards generated changes an earlier refused attempt had already staged, so a resumed run still commits source only', async () => {
		const { cwd, runDir } = setupTicketBranch();

		writeRepoFile({ cwd, path: 'src.ts', content: 'export const value = 1;\n' });
		writeRepoFile({ cwd, path: 'plugin/dist/cli.mjs', content: '// rebuilt on the branch\n' });
		// stands in for the earlier attempt whose own `git add -A` staged the build
		// output before its `git commit` was refused
		execSync('git add -A', { cwd, stdio: 'ignore' });

		const committed = await commitWorkOrderWork({ cwd, composeMessage: async () => 'LO-79 resumed run', runDir, generated: generatedPaths });

		expect(committed).toStrictEqual({ committed: true, message: 'LO-79 resumed run' });
		expect(committedPaths({ cwd })).toStrictEqual(['src.ts']);
		expect(readFileSync(join(cwd, 'plugin', 'dist', 'cli.mjs'), 'utf8')).toBe('// built on main\n');
	});

	test('stages only the directory the change detection reads', async () => {
		const { cwd: repo } = setupTicketBranch();
		const consumer = join(repo, 'apps', 'api');

		writeRepoFile({ cwd: repo, path: 'apps/api/src.ts', content: 'export const value = 1;\n' });
		// a sibling the run never saw: the change detection reads under the consumer
		// directory alone, so nothing outside it may ride into the commit
		writeRepoFile({ cwd: repo, path: 'unrelated.ts', content: 'export const unrelated = 1;\n' });

		const committed = await commitWorkOrderWork({
			cwd: consumer,
			composeMessage: async () => 'LO-152 consumer only',
			runDir: join(consumer, '.lightsout', 'runs', 'run-1'),
		});

		expect(committed).toStrictEqual({ committed: true, message: 'LO-152 consumer only' });
		expect(committedPaths({ cwd: repo })).toStrictEqual(['apps/api/src.ts']);
	});

	test('keeps generated changes on disk but out of the commit when asked to keep them', async () => {
		const { cwd, runDir } = setupTicketBranch();

		writeRepoFile({ cwd, path: 'src.ts', content: 'export const value = 1;\n' });
		writeRepoFile({ cwd, path: 'plugin/dist/cli.mjs', content: '// rebuilt on the branch\n' });
		writeRepoFile({ cwd, path: 'plugin/dist/chunk.mjs', content: '// built on the branch\n' });

		const committed = await commitWorkOrderWork({
			cwd,
			composeMessage: async () => 'LO-187 keep build output',
			runDir,
			generated: generatedPaths,
			keepGenerated: true,
		});

		expect(committed).toStrictEqual({ committed: true, message: 'LO-187 keep build output' });
		expect(committedPaths({ cwd })).toStrictEqual(['src.ts']);
		// the default would have restored the tracked file and removed the new one;
		// keeping leaves both with the branch's contents, uncommitted
		expect(readFileSync(join(cwd, 'plugin', 'dist', 'cli.mjs'), 'utf8')).toBe('// rebuilt on the branch\n');
		expect(readFileSync(join(cwd, 'plugin', 'dist', 'chunk.mjs'), 'utf8')).toBe('// built on the branch\n');
		expect(execSync('git status --porcelain --untracked-files=all', { cwd }).toString().split('\n').filter(Boolean).sort()).toStrictEqual([
			' M plugin/dist/cli.mjs',
			'?? plugin/dist/chunk.mjs',
		]);
	});

	test('unstages generated output an agent staged, so a kept file never reaches the commit', async () => {
		const { cwd, runDir } = setupTicketBranch();

		writeRepoFile({ cwd, path: 'src.ts', content: 'export const value = 1;\n' });
		writeRepoFile({ cwd, path: 'plugin/dist/cli.mjs', content: '// rebuilt on the branch\n' });
		// stands in for an agent that ran its own `git add -A` over the build output
		execSync('git add -A', { cwd, stdio: 'ignore' });

		const committed = await commitWorkOrderWork({
			cwd,
			composeMessage: async () => 'LO-187 agent staged output',
			runDir,
			generated: generatedPaths,
			keepGenerated: true,
		});

		expect(committed).toStrictEqual({ committed: true, message: 'LO-187 agent staged output' });
		expect(committedPaths({ cwd })).toStrictEqual(['src.ts']);
		// a blank index column: the rebuilt file is changed on disk and unstaged
		expect(execSync('git status --porcelain --untracked-files=all', { cwd }).toString().split('\n').filter(Boolean)).toStrictEqual([' M plugin/dist/cli.mjs']);
	});

	test('reports nothing to commit and keeps the output when the only change was generated and keeping is asked for', async () => {
		const { cwd, runDir } = setupTicketBranch();

		writeRepoFile({ cwd, path: 'plugin/dist/chunk.mjs', content: '// built on the branch\n' });

		const committed = await commitWorkOrderWork({
			cwd,
			composeMessage: async () => 'LO-187 build only',
			runDir,
			generated: generatedPaths,
			keepGenerated: true,
		});

		expect(committed).toStrictEqual({ committed: false });
		expect(headSubject({ cwd })).toBe('ignore');
		expect(readFileSync(join(cwd, 'plugin', 'dist', 'chunk.mjs'), 'utf8')).toBe('// built on the branch\n');
		expect(execSync('git status --porcelain --untracked-files=all', { cwd }).toString().split('\n').filter(Boolean)).toStrictEqual([
			'?? plugin/dist/chunk.mjs',
		]);
	});

	test('says how many generated paths it kept on disk and never claims a discard', async () => {
		const { cwd, runDir } = setupTicketBranch();
		const lines: string[] = [];

		writeRepoFile({ cwd, path: 'src.ts', content: 'export const value = 1;\n' });
		writeRepoFile({ cwd, path: 'plugin/dist/chunk.mjs', content: '// built on the branch\n' });
		writeRepoFile({ cwd, path: 'packages/web-app/src/routeTree.gen.ts', content: 'export const routeTree = 1;\n' });

		await commitWorkOrderWork({
			cwd,
			composeMessage: async () => 'LO-187 says what it kept',
			runDir,
			generated: generatedPaths,
			keepGenerated: true,
			onProgress: (message) => lines.push(message),
		});

		expect(lines).toEqual(expect.arrayContaining([expect.stringContaining('kept 2 generated path(s)')]));
		expect(lines.filter((line) => /discard/.test(line))).toStrictEqual([]);
	});

	test('commits source in keep mode when a configured generated entry is absent from disk', async () => {
		const { cwd, runDir } = setupTicketBranch();

		writeRepoFile({ cwd, path: 'src.ts', content: 'export const value = 1;\n' });

		// `out/never-built/` exists nowhere in the fixture, so its staging exclusion matches nothing
		const committed = await commitWorkOrderWork({
			cwd,
			composeMessage: async () => 'LO-187 absent entry',
			runDir,
			generated: [...generatedPaths, 'out/never-built/'],
			keepGenerated: true,
		});

		expect(committed).toStrictEqual({ committed: true, message: 'LO-187 absent entry' });
		expect(committedPaths({ cwd })).toStrictEqual(['src.ts']);
	});

	test('reports what git refused when kept generated changes cannot be unstaged', async () => {
		const { cwd, runDir } = setupTicketBranch();

		writeRepoFile({ cwd, path: 'src.ts', content: 'export const value = 1;\n' });
		writeRepoFile({ cwd, path: 'plugin/dist/cli.mjs', content: '// rebuilt on the branch\n' });
		// An index git will not let go of is the simplest way to make the unstage
		// fail while the tree still reads as changed.
		writeFileSync(join(cwd, '.git', 'index.lock'), '');

		const committed = await commitWorkOrderWork({
			cwd,
			composeMessage: async () => 'LO-187 unstage blocked',
			runDir,
			generated: generatedPaths,
			keepGenerated: true,
		});

		expect(committed).toEqual({ error: expect.stringMatching(/could not unstage the generated changes/) });
		expect(committed).toEqual({ error: expect.stringContaining(cwd) });
		expect(headSubject({ cwd })).toBe('ignore');
	});
});
