import { gitTimeoutMs } from '#src/common/constants/gitTimeoutMs.ts';
import { runCommand } from '#src/common/processes/runCommand.ts';

interface Params {
	cwd: string;
	sha: string;
}

/** A numstat column: a count of lines, or `-` for a binary file, which counts as none. */
const countColumn = ({ column }: { column: string | undefined }) => {
	const count = Number(column);

	return Number.isInteger(count) && count >= 0 ? count : 0;
};

/** The lines one commit added and removed across every file, binary files counted as zero; undefined when git cannot answer. */
export const readGitCommitLineCounts = async ({ cwd, sha }: Params): Promise<{ added: number; removed: number } | undefined> => {
	const answer = await runCommand({ command: `git show --numstat --format= ${sha}`, cwd, timeoutMs: gitTimeoutMs }).catch(() => undefined);

	if (answer?.exitCode !== 0) {
		return undefined;
	}

	let added = 0;
	let removed = 0;

	for (const line of answer.stdout.split('\n')) {
		const [addedColumn, removedColumn] = line.split('\t');

		if (line.trim() !== '') {
			added += countColumn({ column: addedColumn });
			removed += countColumn({ column: removedColumn });
		}
	}

	return { added, removed };
};
