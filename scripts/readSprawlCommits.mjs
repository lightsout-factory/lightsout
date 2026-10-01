import { execFileSync } from 'node:child_process';

/**
 * The full sha, because every git command given one must name exactly one
 * commit; only the dataset shortens it, for display.
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
			return { sha, at, subject: subject.join('\t') };
		});
};
