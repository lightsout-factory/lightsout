import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { discardGeneratedChanges } from '#src/commit/discardGeneratedChanges.ts';
import { setupTicketBranch } from '#tests/helpers/setupTicketBranch.ts';
import { writeRepoFile } from '#tests/helpers/writeRepoFile.ts';

/**
 * A ticket branch whose tracked build artefact was rewritten, beside a new
 * untracked one and an uncommitted edit to a tracked source file — the source
 * edit is never handed to the subject, so it must survive untouched.
 */
const setupDirtyGeneratedTree = () => {
	const { cwd } = setupTicketBranch();

	writeRepoFile({ cwd, path: 'plugin/dist/cli.mjs', content: '// rebuilt on the branch\n' });
	writeRepoFile({ cwd, path: 'plugin/dist/chunk.mjs', content: '// built on the branch\n' });
	writeRepoFile({ cwd, path: 'feature.md', content: '# feature, edited\n' });

	return { cwd, paths: ['plugin/dist/cli.mjs', 'plugin/dist/chunk.mjs'] };
};

describe('discardGeneratedChanges', () => {
	test('restores tracked and removes untracked generated paths, touching nothing it was not given', async () => {
		const { cwd, paths } = setupDirtyGeneratedTree();

		const failure = await discardGeneratedChanges({ cwd, paths });

		expect({
			failure,
			tracked: readFileSync(join(cwd, 'plugin', 'dist', 'cli.mjs'), 'utf8'),
			untrackedExists: existsSync(join(cwd, 'plugin', 'dist', 'chunk.mjs')),
			source: readFileSync(join(cwd, 'feature.md'), 'utf8'),
		}).toStrictEqual({
			failure: undefined,
			tracked: '// built on main\n',
			untrackedExists: false,
			source: '# feature, edited\n',
		});
	});
});
