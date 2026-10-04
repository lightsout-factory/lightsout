import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import type { PipelineRun } from '#src/pipeline/common/PipelineRun.ts';
import { commitAll } from '#tests/helpers/commitAll.ts';
import { runInRepo } from '#tests/helpers/runInRepo.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';
import { writeRepoFile } from '#tests/helpers/writeRepoFile.ts';

type Content = string | Buffer;

interface Edits {
	/** Written after the phase start and before any move, so git never tracked them. */
	untracked?: Record<string, string>;
	/** Moved on disk byte for byte, a file or a whole folder, and left unstaged. */
	rename?: Record<string, string>;
	remove?: string[];
	write?: Record<string, Content>;
	/** Staged and then deleted within the run, which git reports as `AD`. */
	createdAndDeleted?: string[];
}

const plant = ({ cwd, files }: { cwd: string; files: Record<string, Content> }) => {
	for (const [path, content] of Object.entries(files)) {
		mkdirSync(dirname(join(cwd, path)), { recursive: true });
		writeFileSync(join(cwd, path), content);
	}
};

/**
 * A PipelineRun stub over a real git repo, for the move-only check. `committed`
 * is what `HEAD` carries at the phase start, beside the repo's own
 * `src/index.js` and `src/useIndex.js`; `edits` is what the implement agent
 * left in the working tree.
 */
export const setupMoveCheck = ({
	git = true,
	committed = {},
	edits = {},
	baselineDirtyFiles = [],
	generated,
	unbornHead = false,
}: {
	git?: boolean;
	committed?: Record<string, Content>;
	edits?: Edits;
	baselineDirtyFiles?: string[];
	generated?: string[];
	/** Leaves the committed files staged on a branch with no commit, so git reports changes but `HEAD` names nothing. */
	unbornHead?: boolean;
} = {}) => {
	const cwd = setupConsumerRepo({ git });

	plant({ cwd, files: committed });

	if (git && Object.keys(committed).length > 0) {
		commitAll({ cwd, message: 'the phase start' });
	}

	if (unbornHead) {
		runInRepo({ cwd, command: 'git', args: ['checkout', '-q', '--orphan', 'unborn'] });
	}

	plant({ cwd, files: edits.untracked ?? {} });

	for (const [from, to] of Object.entries(edits.rename ?? {})) {
		mkdirSync(dirname(join(cwd, to)), { recursive: true });
		renameSync(join(cwd, from), join(cwd, to));
	}

	for (const path of edits.remove ?? []) {
		rmSync(join(cwd, path));
	}

	plant({ cwd, files: edits.write ?? {} });

	for (const path of edits.createdAndDeleted ?? []) {
		writeRepoFile({ cwd, path, content: 'export const transient = 1;\n' });
		runInRepo({ cwd, command: 'git', args: ['add', path] });
		rmSync(join(cwd, path));
	}

	const progressLines: string[] = [];
	const manifest = { runId: 'run-1', changedFiles: [], packages: [], baselineDirtyFiles } as unknown as RunManifest;
	const run = {
		cwd,
		config: { gates: { check: 'true', test: 'true' }, ...(generated ? { generated } : {}) } as unknown as LightsoutConfig,
		current: () => manifest,
		progress: (message: string) => progressLines.push(message),
	} as unknown as PipelineRun;

	return { run, progressLines };
};
