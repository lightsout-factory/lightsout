import type { ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseFlags } from '#src/cli/common/parseFlags.ts';
import type { CommandContext } from '#src/common/types/CommandContext.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { type CapturedCommandOutput, captureCommandOutput } from '#tests/helpers/captureCommandOutput.ts';
import { seedRunDir } from '#tests/helpers/seedRunDir.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';
import { spawnStandInEngine } from '#tests/helpers/spawnStandInEngine.ts';
import { stopCommandFixture } from '#tests/helpers/stopCommandFixture.ts';
import { writeRunLockFile } from '#tests/helpers/writeRunLockFile.ts';

/**
 * A queue worker run from before owner records: its worktree's lock and the
 * launching checkout's lock are both held by the queue's own process, and the
 * command is addressed at the worker run.
 */
export const setupPreOwnerQueueWorker = async (): Promise<CapturedCommandOutput & { context: CommandContext; child: ChildProcess }> => {
	const { rootId, queueRunId } = stopCommandFixture;
	const captured = captureCommandOutput();
	const cwd = setupConsumerRepo({ git: false });
	const { child, pid } = await spawnStandInEngine();
	const workspace = mkdtempSync(join(tmpdir(), 'lightsout-stop-worktree-'));

	await seedRunDir({ cwd, manifest: { runId: queueRunId, pipeline: PipelineKind.Queue, status: RunStatus.Running, currentStep: null } });
	await seedRunDir({ cwd, manifest: { runId: rootId, status: RunStatus.Running, currentStep: 'implement', workspace } });
	writeRunLockFile({ dir: workspace, pid, runId: rootId });
	writeRunLockFile({ dir: cwd, pid, runId: queueRunId });

	return { context: { flags: parseFlags({ args: ['--run', rootId] }), rest: [], cwd }, child, ...captured };
};
