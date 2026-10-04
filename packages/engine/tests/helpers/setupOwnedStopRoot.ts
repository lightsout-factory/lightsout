import type { ChildProcess } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { jest } from '@jest/globals';
import { parseFlags } from '#src/cli/common/parseFlags.ts';
import { readProcessStartTime } from '#src/common/processes/readProcessStartTime.ts';
import type { CommandContext } from '#src/common/types/CommandContext.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { type CapturedCommandOutput, captureCommandOutput } from '#tests/helpers/captureCommandOutput.ts';
import { seedRunDir } from '#tests/helpers/seedRunDir.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';
import { spawnStandInEngine } from '#tests/helpers/spawnStandInEngine.ts';
import { spyOnProcessKill } from '#tests/helpers/spyOnProcessKill.ts';
import { stopCommandFixture } from '#tests/helpers/stopCommandFixture.ts';

/** What the root's owner.json holds: a live engine whose start time matches, mismatches or was never read; a dead pid; or the queue-worker pointer. */
type OwnerKind = 'confirmed' | 'mismatched' | 'unconfirmable' | 'dead' | 'pointer';

interface Params {
	owner?: OwnerKind;
	pipeline?: PipelineKind;
	status?: RunStatus;
	willShip?: boolean;
	ignoresSigterm?: boolean;
	signals?: Parameters<typeof spyOnProcessKill>[0]['signals'];
}

const ownerRecordFor = async ({ kind, pid }: { kind: OwnerKind; pid: number }) => {
	const recordedAt = '2026-01-01T00:00:01.000Z';

	if (kind === 'pointer') {
		return { queueRunId: stopCommandFixture.queueRunId };
	}

	if (kind === 'dead') {
		return { pid: stopCommandFixture.deadPid, processStartTime: stopCommandFixture.staleStartTime, recordedAt };
	}

	if (kind === 'unconfirmable') {
		return { pid, recordedAt };
	}

	return { pid, processStartTime: kind === 'mismatched' ? stopCommandFixture.staleStartTime : await readProcessStartTime({ pid }), recordedAt };
};

/**
 * One root run with an owner record, a stand-in engine behind it, and the
 * command addressed at the root's id.
 *
 * @param owner - what the root's owner.json holds
 * @param pipeline - the root's pipeline
 * @param status - the root's status
 * @param willShip - whether the root still has a ship ahead of it
 * @param ignoresSigterm - whether the stand-in engine traps SIGTERM
 * @param signals - how the spied `process.kill` answers
 */
export const setupOwnedStopRoot = async ({
	owner = 'confirmed',
	pipeline = PipelineKind.Implement,
	status = RunStatus.Running,
	willShip = false,
	ignoresSigterm = false,
	signals = 'real',
}: Params = {}): Promise<
	CapturedCommandOutput & {
		context: CommandContext;
		cwd: string;
		child: ChildProcess;
		pid: number;
		kill: jest.SpiedFunction<typeof process.kill>;
		manifestPath: string;
		manifestBefore: string;
	}
> => {
	const captured = captureCommandOutput();
	const cwd = setupConsumerRepo({ git: false });
	const { child, pid } = await spawnStandInEngine({ ignoresSigterm });
	const runDir = await seedRunDir({
		cwd,
		manifest: {
			runId: stopCommandFixture.rootId,
			pipeline,
			status,
			currentStep: status === RunStatus.Running ? 'implement' : null,
			...(willShip ? { willShip } : {}),
		},
	});
	const manifestPath = join(runDir, 'manifest.json');

	writeFileSync(join(runDir, 'owner.json'), JSON.stringify(await ownerRecordFor({ kind: owner, pid })));

	const kill = spyOnProcessKill({ signals });

	return {
		context: { flags: parseFlags({ args: ['--run', stopCommandFixture.rootId] }), rest: [], cwd },
		cwd,
		child,
		pid,
		kill,
		manifestPath,
		manifestBefore: readFileSync(manifestPath, 'utf8'),
		...captured,
	};
};
