import { execFileSync } from 'node:child_process';

/**
 * The sha is abbreviated here rather than by git, whose `%h` length grows with
 * the object count and would rewrite every line of the dataset, which must be
 * byte-identical between rebuilds at the same HEAD.
 */
export const readSprawlCommits = ({ repoRoot }) => {
	const output = execFileSync('git', ['log', '--reverse', '--format=%H%x09%aI%x09%s', '--', 'packages/**/*.ts', 'packages/**/*.tsx'], {
		cwd: repoRoot,
		encoding: 'utf8',
		maxBuffer: 64 * 1024 * 1024,
	});

	return output
		.split('\n')
		.filter((line) => line.length > 0)
		.map((line) => {
			const [sha, at, ...subject] = line.split('\t');

			// A subject may itself contain a tab.
			return { sha: sha.slice(0, 7), at, subject: subject.join('\t') };
		});
};
