import type { ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseFlags } from '#src/cli/parseFlags.ts';
import type { CommandContext } from '#src/common/types/CommandContext.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { type CapturedCommandOutput, captureCommandOutput } from '#tests/helpers/captureCommandOutput.ts';
import { seedRunDir } from '#tests/helpers/seedRunDir.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';
import { spawnStandInEngine } from '#tests/helpers/spawnStandInEngine.ts';
import { stopCommandFixture } from '#tests/helpers/stopCommandFixture.ts';
import { writeRunLockFile } from '#tests/helpers/writeRunLockFile.ts';

interface Params {
	holder: 'root' | 'phase child' | 'unrelated run' | 'dead holder' | 'nobody';
	status?: RunStatus;
}

/**
 * A root from before owner records, with a live engine holding the run lock
 * under the named run's id.
 *
 * @param holder - which run the lock names: the root itself, its moving phase child, or a run of another family; or the root under a dead pid, or no lock at all
 * @param status - the root's status
 */
export const setupLockedStopRun = async ({
	holder,
	status = RunStatus.Running,
}: Params): Promise<CapturedCommandOutput & { context: CommandContext; child: ChildProcess }> => {
	const { rootId, phaseChildId, otherRunId, deadPid } = stopCommandFixture;
	const captured = captureCommandOutput();
	const cwd = setupConsumerRepo({ git: false });
	const { child, pid } = await spawnStandInEngine();
	const workspace = holder === 'root' ? mkdtempSync(join(tmpdir(), 'lightsout-stop-workspace-')) : undefined;
	const root: Partial<RunManifest> & { runId: string } = {
		runId: rootId,
		pipeline: holder === 'phase child' ? PipelineKind.Phases : PipelineKind.Implement,
		status,
		currentStep: holder === 'phase child' ? 'phase-1' : 'implement',
		...(workspace === undefined ? {} : { workspace }),
	};

	await seedRunDir({ cwd, manifest: root });

	if (holder === 'phase child') {
		await seedRunDir({ cwd, manifest: { runId: phaseChildId, parentRunId: rootId, status: RunStatus.Running, currentStep: 'implement' } });
	}

	if (holder === 'unrelated run') {
		await seedRunDir({ cwd, manifest: { runId: otherRunId, status: RunStatus.Running, currentStep: 'implement' } });
	}

	const lockedRunId = { root: rootId, 'phase child': phaseChildId, 'unrelated run': otherRunId, 'dead holder': rootId, nobody: rootId }[holder];

	if (holder !== 'nobody') {
		writeRunLockFile({ dir: workspace ?? cwd, pid: holder === 'dead holder' ? deadPid : pid, runId: lockedRunId });
	}

	return { context: { flags: parseFlags({ args: ['--run', rootId] }), rest: [], cwd }, child, ...captured };
};
