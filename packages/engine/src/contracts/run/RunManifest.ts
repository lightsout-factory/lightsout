import { z } from 'zod';
import { AcceptanceTestRecord } from '#src/contracts/run/AcceptanceTestRecord.ts';
import { ApprovedTestRecord } from '#src/contracts/run/ApprovedTestRecord.ts';
import { PackagesSource } from '#src/contracts/run/PackagesSource.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import { RunCommit } from '#src/contracts/run/RunCommit.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { RunUsage } from '#src/contracts/run/RunUsage.ts';
import { StepRecord } from '#src/contracts/run/StepRecord.ts';

/** State lives here rather than in a model's context, so runs survive crashes and rate limits and resume at the failed step. */
export const RunManifest = z.object({
	runId: z.string(),
	createdAt: z.string(),
	updatedAt: z.string(),
	/** Relative to the target repo. For a phases run this is the overview path. */
	plan: z.string(),
	/** A plan address `<work-order>/<plan-id>`. Absent on a run that belongs to no plan, including an implement run of a plan file outside the plans directory. */
	planName: z.string().optional(),
	/** Absent means implement. */
	pipeline: z.enum(PipelineKind).optional(),
	/** The ticket this run builds, e.g. 'LO-70'. Absent on a run started from a plan. */
	ticketRef: z.string().optional(),
	/** Relative to the target repo. */
	overview: z.string().optional(),
	/** Set on a phase's child run to the coordinator's run id. */
	parentRunId: z.string().optional(),
	/** A resumed run must reuse it. */
	harness: z.string(),
	/**
	 * The config the run is held to. Kept as plain data so a manifest stays
	 * readable when the engine's config schema changes; it is validated strictly
	 * only where a run uses it.
	 */
	config: z.record(z.string(), z.unknown()).optional(),
	/** Absolute, because its reader stands in another checkout: the file the recorded config was read from. Absent on a run that has no recorded path. */
	configPath: z.string().optional(),
	status: z.enum(RunStatus),
	currentStep: z.string().nullable(),
	steps: z.array(StepRecord),
	/** Lets a reader show a row for a step not yet reached. Absent on a pipeline that discovers its steps as it goes. */
	stepOrder: z.array(z.string()).optional(),
	/** The key a ship result is filed under. Absent on a detached HEAD and outside a worktree. */
	branch: z.string().optional(),
	/** Absolute. Absent on a run that built in the checkout it was launched from. */
	workspace: z.string().optional(),
	/** A passing run will ship this branch. Absent when no ship intent was resolved. */
	willShip: z.boolean().optional(),
	changedFiles: z.array(z.string()),
	/** A phased run's coordinator carries one per phase; every other run carries at most one. */
	commits: z.array(RunCommit).default([]),
	/**
	 * Directory names under the packages dir. Expanded as changed files reveal
	 * the blast radius, never shrunk. Empty in non-monorepo mode.
	 */
	packages: z.array(z.string()).default([]),
	/** Recorded so a derived scope is never mistaken for a declared one. */
	packagesSource: z.enum(PackagesSource).optional(),
	/** Per-invocation detail lives in the run dir's `agents.jsonl`. Absent for drivers reporting nothing. */
	usage: RunUsage.optional(),
	/** Paths already dirty when the run started, subtracted from every git snapshot so only the run's own changes are attributed to it. */
	baselineDirtyFiles: z.array(z.string()).default([]),
	/** What verify fix re-invocations hand back to test writers. */
	testSubjects: z.array(z.string()).default([]),
	/** One entry per plan ledger row. */
	acceptanceTests: z.array(AcceptanceTestRecord).default([]),
	approvedTests: z.array(ApprovedTestRecord).default([]),
	/** Changed files the write-tests step skipped because nothing public reaches them; re-checked at run end. */
	unreachableChangedFiles: z.array(z.string()).default([]),
	/** Files the repo's coverage configuration does not collect, so verify fix re-invocations must not demand their execution. */
	coverageExcludedChangedFiles: z.array(z.string()).default([]),
});

export type RunManifest = z.infer<typeof RunManifest>;
