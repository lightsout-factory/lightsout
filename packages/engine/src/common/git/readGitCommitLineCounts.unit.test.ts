import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { readGitCommitLineCounts } from '#src/common/git/readGitCommitLineCounts.ts';
import { commitAll } from '#tests/helpers/commitAll.ts';
import { runInRepo } from '#tests/helpers/runInRepo.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';

/** The sha of the newest commit, as git names it. */
const headSha = ({ cwd }: { cwd: string }): string => runInRepo({ cwd, command: 'git', args: ['rev-parse', 'HEAD'] }).trim();

/**
 * A repo with two measured commits on top of a base: one that adds a 3-line
 * file and removes 1 line from another, and one that adds a binary file beside
 * a 2-line text file. Answers both shas and one no commit carries.
 */
const setupCommits = () => {
	const cwd = setupConsumerRepo();
	writeFileSync(join(cwd, 'notes.txt'), 'first\nsecond\n');
	commitAll({ cwd, message: 'base' });

	writeFileSync(join(cwd, 'added.txt'), 'one\ntwo\nthree\n');
	writeFileSync(join(cwd, 'notes.txt'), 'first\n');
	commitAll({ cwd, message: 'text change' });
	const textSha = headSha({ cwd });

	writeFileSync(join(cwd, 'image.bin'), Buffer.from([0x00, 0xff, 0x00, 0x10, 0x00, 0x7f, 0x00]));
	writeFileSync(join(cwd, 'more.txt'), 'x\ny\n');
	commitAll({ cwd, message: 'binary change' });
	const binarySha = headSha({ cwd });

	return { cwd, textSha, binarySha, unknownSha: '0123456789abcdef0123456789abcdef01234567' };
};

/** A working directory that does not exist, so the spawn itself fails, and any sha. */
const setupMissingDirectory = () => ({ cwd: '/lightsout/no/such/directory', sha: '0123456789abcdef0123456789abcdef01234567' });

describe('readGitCommitLineCounts', () => {
	test('readGitCommitLineCounts: sums numstat lines, counts binary as zero, answers undefined for an unknown sha', async () => {
		const { cwd, textSha, binarySha, unknownSha } = setupCommits();

		const counts = await Promise.all([
			readGitCommitLineCounts({ cwd, sha: textSha }),
			readGitCommitLineCounts({ cwd, sha: binarySha }),
			readGitCommitLineCounts({ cwd, sha: unknownSha }),
		]);

		expect(counts).toStrictEqual([{ added: 3, removed: 1 }, { added: 2, removed: 0 }, undefined]);
	});

	test('readGitCommitLineCounts: a directory git cannot even start in answers undefined rather than raising the spawn failure', async () => {
		const { cwd, sha } = setupMissingDirectory();

		const counts = await readGitCommitLineCounts({ cwd, sha });

		// the measurement is optional: a commit whose lines cannot be counted records none
		expect(counts).toBeUndefined();
	});
});
