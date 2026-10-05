import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { readGitStatusEntries } from '#src/common/git/readGitStatusEntries.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';

/** A committed consumer repo plus working-tree edits: `write` plants files by repo-relative path, `rename` stages a `git mv`. */
const setupChangedRepo = ({
	git = true,
	write = {},
	rename,
	at,
}: {
	git?: boolean;
	write?: Record<string, string>;
	rename?: { from: string; to: string };
	/** The subdirectory the read is anchored at. */
	at?: string;
} = {}) => {
	const root = setupConsumerRepo({ git });

	for (const [path, content] of Object.entries(write)) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), content);
	}

	if (rename) {
		execSync(`git mv ${rename.from} ${rename.to}`, { cwd: root });
	}

	return { cwd: at ? join(root, at) : root };
};

const sorted = ({ entries }: { entries: { code: string; path: string }[] | undefined }) =>
	[...(entries ?? [])].sort((left, right) => left.path.localeCompare(right.path));

describe('readGitStatusEntries', () => {
	test('each changed file is answered with the status letters git printed for it', async () => {
		const { cwd } = setupChangedRepo({ write: { 'src/index.js': 'export const one = 2;\n', 'src/added.ts': 'export const added = 1;\n' } });

		const entries = await readGitStatusEntries({ cwd, splitRenames: false });

		expect(sorted({ entries })).toStrictEqual([
			{ code: '??', path: 'src/added.ts' },
			{ code: ' M', path: 'src/index.js' },
		]);
	});

	test('a move is one entry naming the destination when renames are kept together', async () => {
		const { cwd } = setupChangedRepo({ rename: { from: 'src/index.js', to: 'src/renamed.js' } });

		const entries = await readGitStatusEntries({ cwd, splitRenames: false });

		expect(entries).toStrictEqual([{ code: 'R ', path: 'src/renamed.js' }]);
	});

	test('a move is a removal and an addition when renames are split', async () => {
		const { cwd } = setupChangedRepo({ rename: { from: 'src/index.js', to: 'src/renamed.js' } });

		const entries = await readGitStatusEntries({ cwd, splitRenames: true });

		expect(sorted({ entries })).toStrictEqual([
			{ code: 'D ', path: 'src/index.js' },
			{ code: 'A ', path: 'src/renamed.js' },
		]);
	});

	test('paths are relative to the folder the read is anchored at', async () => {
		const { cwd } = setupChangedRepo({ write: { 'src/added.ts': 'export const added = 1;\n' }, at: 'src' });

		const entries = await readGitStatusEntries({ cwd, splitRenames: false });

		expect(entries).toStrictEqual([{ code: '??', path: 'added.ts' }]);
	});

	test('a path git quotes is answered without its quotes', async () => {
		const { cwd } = setupChangedRepo({ write: { 'src/two words.ts': 'export const added = 1;\n' } });

		const entries = await readGitStatusEntries({ cwd, splitRenames: true });

		expect(entries).toStrictEqual([{ code: '??', path: 'src/two words.ts' }]);
	});

	test('run state under .lightsout/ is left out', async () => {
		const { cwd } = setupChangedRepo({ write: { '.lightsout/runs/run-1/manifest.json': '{}\n' } });

		const entries = await readGitStatusEntries({ cwd, splitRenames: false });

		expect(entries).toStrictEqual([]);
	});

	test('a folder outside any git worktree answers undefined', async () => {
		const { cwd } = setupChangedRepo({ git: false });

		const entries = await readGitStatusEntries({ cwd, splitRenames: false });

		expect(entries).toBeUndefined();
	});
});
