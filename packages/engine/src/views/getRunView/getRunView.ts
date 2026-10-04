import { access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { readJsonlRecords } from '#src/common/utils/readJsonlRecords.ts';
import { PhaseReport } from '#src/contracts/run/PhaseReport.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import { AgentInvocation } from '#src/contracts/views/AgentInvocation.ts';
import { GateEvidence } from '#src/contracts/views/GateEvidence.ts';
import type { RunStepView } from '#src/contracts/views/RunStepView.ts';
import type { RunView } from '#src/contracts/views/RunView.ts';
import { resolveRunDir } from '#src/runState/common/paths/resolveRunDir.ts';
import { readFriction } from '#src/runState/readFriction.ts';
import { readRunLiveness } from '#src/runState/readRunLiveness.ts';
import { readRunManifest } from '#src/runState/readRunManifest.ts';
import { summarizeRun } from '#src/runState/summarizeRun.ts';
import { getRunTitle } from '#src/views/common/getRunTitle.ts';
import { readFrozenWorklist } from '#src/views/common/readFrozenWorklist.ts';
import { readRunListing } from '#src/views/common/readRunListing/readRunListing.ts';
import { buildRunBurnDown } from '#src/views/getRunView/buildRunBurnDown.ts';

type StepUsage = Map<string, { invocations: number; outputTokens: number; costUsd: number }>;

/**
 * A coordinator's step ids are the phase file names, extension included, so they
 * join the overview's directory as they stand. A phase deleted after its run is
 * not offered as something to open.
 */
const resolvePhaseFile = async ({ cwd, overviewDir, step }: { cwd: string; overviewDir: string; step: StepRecord }) => {
	const planPath = join(overviewDir, step.id);
	const exists = await access(join(cwd, planPath)).then(
		() => true,
		() => false,
	);

	return exists ? planPath : undefined;
};

const buildStepView = async ({
	cwd,
	step,
	usage,
	overviewDir,
}: {
	cwd: string;
	step: StepRecord;
	usage: StepUsage;
	overviewDir?: string;
}): Promise<RunStepView> => {
	const child = PhaseReport.safeParse(step.report);

	return {
		id: step.id,
		status: step.status,
		attempts: step.attempts,
		durationMs: step.durationMs,
		changedFiles: step.changedFiles ?? [],
		error: step.error,
		...(usage.get(step.id) ?? { invocations: 0, outputTokens: 0, costUsd: 0 }),
		report: step.report,
		planPath: overviewDir === undefined ? undefined : await resolvePhaseFile({ cwd, overviewDir, step }),
		childRunId: overviewDir !== undefined && child.success ? child.data.runId : undefined,
	};
};

/**
 * A coordinator whose manifest will not read leaves the back-link off rather than
 * taking the page down. While the phase is still running the coordinator has no
 * record of this child yet, so its step in flight names it.
 */
const readParent = async ({ cwd, runId, parentRunId }: { cwd: string; runId: string; parentRunId?: string }): Promise<RunView['parent']> => {
	const manifest = parentRunId === undefined ? undefined : await readRunManifest({ cwd, runId: parentRunId }).catch(() => undefined);
	const recorded = manifest?.steps.find((candidate) => PhaseReport.safeParse(candidate.report).data?.runId === runId);
	const step = recorded?.id ?? manifest?.currentStep ?? undefined;

	return manifest === undefined || step === undefined ? undefined : { runId: manifest.runId, step, title: getRunTitle({ plan: manifest.plan }) };
};

interface Params {
	cwd: string;
	runId: string;
}

/**
 * Every number comes from the reader that already owns it, so a detail page and
 * a sidebar row cannot disagree.
 *
 * @param runId - full id, or the shortened form a report printed
 * @throws {RunNotFoundError} When no run on disk answers to the id.
 */
export const getRunView = async ({ cwd, runId }: Params): Promise<RunView> => {
	const manifest = await readRunManifest({ cwd, runId });
	const runDir = await resolveRunDir({ cwd, runId: manifest.runId });
	const { live } = await readRunLiveness({ cwd, manifest });
	const summary = await summarizeRun({ cwd, manifest });
	const usage: StepUsage = new Map(
		summary.steps.map((step) => [step.id, { invocations: step.invocations, outputTokens: step.outputTokens, costUsd: step.costUsd }]),
	);
	// A coordinator's manifest carries no `overview` field: initializeSequence
	// records the overview as the coordinator's own plan. Its phase files sit
	// beside it, so the same path answers both questions.
	const coordinatorOverview = manifest.pipeline === PipelineKind.Phases ? (manifest.overview ?? manifest.plan) : undefined;
	const overview = coordinatorOverview ?? manifest.overview;
	const overviewDir = coordinatorOverview === undefined ? undefined : dirname(coordinatorOverview);
	const friction = await readFriction({ cwd });
	// Read here rather than inside `readRunListing`, because the burn-down wants
	// the same file.
	const worklist = manifest.plan.endsWith('worklist.json') ? await readFrozenWorklist({ cwd, manifest }) : undefined;

	return {
		listing: await readRunListing({ cwd, manifest, live, worklist }),
		harness: manifest.harness,
		overview,
		currentStep: manifest.currentStep,
		wallMs: summary.wallMs,
		activeMs: summary.activeMs,
		gateMs: summary.gateMs,
		usage: summary.usage,
		cacheReadShare: summary.cacheReadShare,
		steps: await Promise.all(manifest.steps.map((step) => buildStepView({ cwd, step, usage, overviewDir }))),
		gates: await readJsonlRecords({ path: join(runDir, 'commands.jsonl'), schema: GateEvidence }),
		gateTotals: summary.gates,
		agents: await readJsonlRecords({ path: join(runDir, 'agents.jsonl'), schema: AgentInvocation }),
		rejectedReports: summary.rejectedReports,
		friction: friction.filter((entry) => entry.runId === manifest.runId),
		changedFiles: manifest.changedFiles,
		unreachableChangedFiles: manifest.unreachableChangedFiles,
		parent: await readParent({ cwd, runId: manifest.runId, parentRunId: manifest.parentRunId }),
		burnDown: buildRunBurnDown({ manifest, worklist }),
	};
};
