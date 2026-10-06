import { buildUnitTestWriterInvocation } from '#src/agents/buildUnitTestWriterInvocation.ts';
import type { AcceptanceTestRecord } from '#src/contracts/run/AcceptanceTestRecord.ts';
import type { WorkReport } from '#src/contracts/work/WorkReport.ts';
import type { PipelineRun } from '#src/pipeline/common/PipelineRun.ts';
import { createWarmSpawn } from '#src/pipeline/steps/common/createWarmSpawn.ts';
import { createWriterAggregate } from '#src/pipeline/steps/common/createWriterAggregate.ts';
import type { TestTargetGroup } from '#src/pipeline/steps/common/types/TestTargetGroup.ts';
import type { WriterResult } from '#src/pipeline/steps/common/types/WriterResult.ts';
import { drainByHeldFiles } from '#src/pipeline/steps/writeTestsStep/runWriterBatches/drainByHeldFiles.ts';

interface Params {
	run: PipelineRun;
	/** One assignment per writer: the changed files its tests must execute. Groups holding a file in common never run at the same time. */
	groups: TestTargetGroup[];
	planContent: string;
	testStandards?: string;
	/** The run's live acceptance-test mapping — the tests every writer must leave able to execute and pass. */
	acceptanceTests?: AcceptanceTestRecord[];
}

type SpawnWriter = ({ group, onFirstEvent }: { group: TestTargetGroup; onFirstEvent?: () => void }) => Promise<WriterResult>;

export const runWriterBatches = async ({
	run,
	groups,
	planContent,
	testStandards,
	acceptanceTests,
}: Params): Promise<{ reports: WorkReport[]; failures: string[]; terminated: boolean; parked: boolean }> => {
	const aggregate = createWriterAggregate<TestTargetGroup>({ run, step: 'write-tests', label: ({ group }) => group.files.join(', ') });

	const spawnWriter: SpawnWriter = async ({ group, onFirstEvent }) => ({
		group,
		...(await run.invokeRole({
			invocation: buildUnitTestWriterInvocation({
				planContent,
				files: group.files,
				standards: testStandards,
				acceptanceTests,
			}),
			step: 'write-tests',
			onFirstEvent,
		})),
	});

	// One spawn has nothing to warm for; zero groups skip everything below.
	const warmGroup = groups.length > 1 ? groups[0] : undefined;
	const { warm, collectWarm, awaitGate, isSettled } = createWarmSpawn({ group: warmGroup, spawnWriter, aggregate });

	await awaitGate();

	// A warm spawn that already settled must be folded in BEFORE any slot opens:
	// when it rate-limited, the park flag it sets is what keeps the rest from
	// ever spawning.
	if (isSettled()) {
		await collectWarm();
	}

	await drainByHeldFiles({
		groups: warmGroup ? groups.slice(1) : groups,
		spawnWriter,
		aggregate,
		warm: warm && warmGroup ? { spawn: warm, group: warmGroup } : undefined,
		collectWarm,
	});

	await collectWarm();

	return aggregate.result();
};
