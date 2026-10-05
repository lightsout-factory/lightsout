import type { ChildProcess } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFlags } from '#src/cli/parseFlags.ts';
import { readProcessStartTime } from '#src/common/processes/readProcessStartTime.ts';
import type { CommandContext } from '#src/common/types/CommandContext.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { type CapturedCommandOutput, captureCommandOutput } from '#tests/helpers/captureCommandOutput.ts';
import { seedRunDir } from '#tests/helpers/seedRunDir.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';
import { spawnStandInEngine } from '#tests/helpers/spawnStandInEngine.ts';
import { stopCommandFixture } from '#tests/helpers/stopCommandFixture.ts';

interface Params {
	childManifest: boolean;
	run: string;
}

/**
 * A running phases coordinator with a live owner, whose running step names a
 * phase child that may not have a manifest yet.
 *
 * @param childManifest - whether the named phase child has a manifest yet
 * @param run - the run id the command is addressed at
 */
export const setupPhasedStopRoot = async ({
	childManifest,
	run,
}: Params): Promise<CapturedCommandOutput & { context: CommandContext; child: ChildProcess }> => {
	const { rootId, phaseChildId } = stopCommandFixture;
	const captured = captureCommandOutput();
	const cwd = setupConsumerRepo({ git: false });
	const { child, pid } = await spawnStandInEngine();
	const runDir = await seedRunDir({
		cwd,
		manifest: {
			runId: rootId,
			pipeline: PipelineKind.Phases,
			status: RunStatus.Running,
			currentStep: 'phase-1',
			steps: [{ id: 'phase-1', status: RunStatus.Running, attempts: 1, report: { runId: phaseChildId } }],
		},
	});

	if (childManifest) {
		await seedRunDir({ cwd, manifest: { runId: phaseChildId, parentRunId: rootId, status: RunStatus.Running, currentStep: 'implement' } });
	}

	writeFileSync(
		join(runDir, 'owner.json'),
		JSON.stringify({ pid, processStartTime: await readProcessStartTime({ pid }), recordedAt: '2026-01-01T00:00:01.000Z' }),
	);

	return { context: { flags: parseFlags({ args: ['--run', run] }), rest: [], cwd }, child, ...captured };
};
