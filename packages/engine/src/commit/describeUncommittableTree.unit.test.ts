import { describe, expect, jest, test } from '@jest/globals';
import { describeUncommittableTree } from '#src/commit/describeUncommittableTree.ts';

// Mocked Imports
// -------------------------
// The git status read has its own tests. What this file owns is the policy:
// which trees are judged at all, and what a judged tree is told.
const mockReadGitChangedFiles = jest.fn<(params: { cwd: string }) => Promise<string[] | undefined>>();

jest.mock('#src/common/git/readGitChangedFiles.ts', () => ({ readGitChangedFiles: (params: { cwd: string }) => mockReadGitChangedFiles(params) }));
// -------------------------

const dirtyCwd = '/repo-worktrees/lo-152-dirty';
const cleanCwd = '/repo-worktrees/lo-152-clean';
const unreadableCwd = '/repo-worktrees/lo-186-unreadable';

/**
 * What `git status` finds in each checkout, keyed by checkout path: a list of
 * uncommitted paths, an empty list for a clean tree, or undefined for a tree
 * git cannot read at all. A checkout the map does not name is clean.
 */
const setupTrees = ({ changed = {} }: { changed?: Record<string, string[] | undefined> } = {}) => {
	mockReadGitChangedFiles.mockImplementation(({ cwd }) => Promise.resolve(Object.hasOwn(changed, cwd) ? changed[cwd] : []));

	return { dirty: dirtyCwd, clean: cleanCwd, unreadable: unreadableCwd };
};

describe('describeUncommittableTree', () => {
	test('refuses a dirty tree and accepts a clean one', async () => {
		const { dirty, clean } = setupTrees({ changed: { [dirtyCwd]: ['thing.ts'] } });

		const refused = await describeUncommittableTree({ cwd: dirty, isolated: false, generated: [] });
		const accepted = await describeUncommittableTree({ cwd: clean, isolated: false, generated: [] });

		// The checkout is named so a person reading the refusal knows which tree
		// to clean; the rest of the wording is theirs to change.
		expect({ refused, accepted }).toEqual({ refused: expect.stringContaining(dirty), accepted: undefined });
		expect(refused).toMatch(/commit|stash/i);
	});

	test('refuses a tree git cannot read', async () => {
		const { dirty } = setupTrees({ changed: { [dirtyCwd]: undefined } });

		const refusal = await describeUncommittableTree({ cwd: dirty, isolated: false, generated: [] });

		// An unreadable tree is never read as an empty one: the run ends in a
		// commit, so a checkout git cannot answer for is a stop, not a green light.
		expect(refusal).toEqual(expect.stringContaining(dirty));
	});

	test('never judges a tree lightsout owns', async () => {
		const { dirty } = setupTrees({ changed: { [dirtyCwd]: ['thing.ts'] } });

		const refusal = await describeUncommittableTree({ cwd: dirty, isolated: true, generated: [] });

		expect(refusal).toBeUndefined();
		// A tree lightsout cut or adopted for the run holds the ticket's own work,
		// so no git state is read at all and the run still starts.
		expect(mockReadGitChangedFiles).not.toHaveBeenCalled();
	});

	test('names every uncommitted path and closes with the default commit-or-stash advice', async () => {
		const { dirty } = setupTrees({ changed: { [dirtyCwd]: ['src/a.ts', 'notes/b.md'] } });

		const refusal = await describeUncommittableTree({ cwd: dirty, isolated: false, generated: [] });

		// A person told only that the tree is dirty has to go and find what is in
		// it; the refusal names every path so they can stash exactly those.
		expect({
			namesCwd: refusal?.includes(dirty),
			namesSource: refusal?.includes('src/a.ts'),
			namesNote: refusal?.includes('notes/b.md'),
			advisesCommitOrStash: /commit or stash/i.test(refusal ?? ''),
		}).toStrictEqual({ namesCwd: true, namesSource: true, namesNote: true, advisesCommitOrStash: true });
	});

	test('exempts generated paths from the judgement', async () => {
		const { dirty, clean } = setupTrees({ changed: { [cleanCwd]: ['dist/out.js'], [dirtyCwd]: ['dist/out.js', 'src/a.ts'] } });

		const generatedOnly = await describeUncommittableTree({ cwd: clean, isolated: false, generated: ['dist/'] });
		const mixed = await describeUncommittableTree({ cwd: dirty, isolated: false, generated: ['dist/'] });

		// Build output an earlier phase left on disk is not a person's edit, so a
		// tree holding only that output is accepted, and a refusal never lists it.
		expect({
			generatedOnly,
			mixedNamesSource: mixed?.includes('src/a.ts'),
			mixedNamesGenerated: mixed?.includes('dist/out.js'),
		}).toStrictEqual({ generatedOnly: undefined, mixedNamesSource: true, mixedNamesGenerated: false });
	});

	test('names the first twenty paths and counts the rest', async () => {
		const paths = Array.from({ length: 23 }, (_, index) => `src/file${String(index + 1).padStart(2, '0')}.ts`);
		const { dirty } = setupTrees({ changed: { [dirtyCwd]: paths } });

		const refusal = await describeUncommittableTree({ cwd: dirty, isolated: false, generated: [] });

		// One large dirty tree must not bury the advice, so the list stops at
		// twenty in git's order and the rest are only counted.
		expect({
			namedFirstTwenty: paths.slice(0, 20).every((path) => refusal?.includes(path)),
			namedAnyOfLastThree: paths.slice(20).some((path) => refusal?.includes(path)),
			countsTheRest: refusal?.includes('3 more'),
			namesInGitOrder: paths
				.slice(0, 20)
				.every((path, index, listed) => index === 0 || (refusal?.indexOf(listed[index - 1]) ?? -1) < (refusal?.indexOf(path) ?? -1)),
		}).toStrictEqual({ namedFirstTwenty: true, namedAnyOfLastThree: false, countsTheRest: true, namesInGitOrder: true });
	});

	test('names all twenty paths of a tree at the cap without counting a rest', async () => {
		const paths = Array.from({ length: 20 }, (_, index) => `src/file${String(index + 1).padStart(2, '0')}.ts`);
		const { dirty } = setupTrees({ changed: { [dirtyCwd]: paths } });

		const refusal = await describeUncommittableTree({ cwd: dirty, isolated: false, generated: [] });

		// The count only stands in for paths left unnamed; at exactly twenty none is.
		expect({
			namedAll: paths.every((path) => refusal?.includes(path)),
			countsARest: / and \d+ more/.test(refusal ?? ''),
		}).toStrictEqual({ namedAll: true, countsARest: false });
	});

	test('closes the refusal with the remedy its caller supplies', async () => {
		const remedy = 'stash them, then resume with: lightsout resume --run phases-run-1';
		const { dirty, unreadable } = setupTrees({ changed: { [dirtyCwd]: ['notes/stray.md'], [unreadableCwd]: undefined } });

		const dirtyRefusal = await describeUncommittableTree({ cwd: dirty, isolated: false, generated: [], remedy });
		const unreadableRefusal = await describeUncommittableTree({ cwd: unreadable, isolated: false, generated: [], remedy });

		// The remedy is advice for a tree holding edits; a tree git cannot read
		// has nothing to stash, so its sentence names the cwd and carries no remedy.
		expect({
			dirtyEndsWithRemedy: dirtyRefusal?.endsWith(remedy),
			dirtyCarriesDefaultAdvice: /commit or stash/i.test(dirtyRefusal ?? ''),
			unreadableNamesCwd: unreadableRefusal?.includes(unreadable),
			unreadableCarriesRemedy: unreadableRefusal?.includes(remedy),
		}).toStrictEqual({ dirtyEndsWithRemedy: true, dirtyCarriesDefaultAdvice: false, unreadableNamesCwd: true, unreadableCarriesRemedy: false });
	});
});
