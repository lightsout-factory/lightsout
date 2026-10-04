import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runDirectoryIndex } from '#src/common/constants/runDirectoryIndex.ts';
import { readGitCurrentBranch } from '#src/common/git/readGitCurrentBranch.ts';
import { resolveNewRunDir } from '#src/common/resolveNewRunDir.ts';
import { toRepoRelativePath } from '#src/common/toRepoRelativePath.ts';
import type { LoadedConfig } from '#src/common/types/LoadedConfig.ts';
import type { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { planNameFromPath } from '#src/plan/planNameFromPath.ts';
import { writeRunOwner } from '#src/runState/owner/writeRunOwner.ts';
import { writeRunManifest } from '#src/runState/writeRunManifest.ts';

interface Params {
	cwd: string;
	/** Pre-minted run id (the lock is taken under it before anything is written). Fresh UUID when omitted. */
	runId?: string;
	/** Plan path as the caller named it, cwd-relative or absolute — recorded cwd-relative either way. */
	plan: string;
	/** Owning pipeline, stamped for resume routing. */
	pipeline?: PipelineKind;
	/** The ticket this run builds, e.g. 'LO-70' — recorded on the manifest. Absent on a run started from a plan. */
	ticketRef?: string;
	/** Optional overview plan path (high-level context for a phased plan), cwd-relative or absolute — recorded cwd-relative either way. */
	overview?: string;
	/** The coordinator's run id, when this run is one phase of a sequence — the one moment the parent link is known, so the one place it is written. */
	parentRunId?: string;
	/** The driver name the run was started with, persisted as the manifest's `harness` field. */
	driver: string;
	/** The config the run started with, as it was read from disk before any command stamped its harness on it, recorded as the manifest's settings, and the path it was read from. Absent only for a caller that has no config at all; every pipeline entry passes one. The path is stored as given, never re-resolved against `cwd`: a run launched from another checkout read its config there. */
	loadedConfig?: LoadedConfig;
	/** Git-dirty paths at run start — the subtraction baseline for changed-file attribution. */
	baselineDirtyFiles?: string[];
	/** Resolved before the run starts: a passing run will ship this branch. Omitted by every pipeline that resolves no ship intent. */
	willShip?: boolean;
	/** The queue run this run is a worker of, so its owner record points there rather than at this process. */
	queueRunId?: string;
}

/**
 * Plan paths are recorded repo-relative whatever form the caller used: every
 * reader joins the record onto the repo, so an absolute `--plan` written as
 * given would read back as a missing file. Enforced here, where every manifest
 * is born. It is also where every family root's owner record is born.
 */
export const createRun = async ({
	cwd,
	runId,
	plan,
	pipeline,
	ticketRef,
	overview,
	parentRunId,
	driver,
	loadedConfig,
	baselineDirtyFiles,
	willShip,
	queueRunId,
}: Params): Promise<RunManifest> => {
	const now = new Date().toISOString();
	// One string answers both fields, so the name can never claim a plan the
	// recorded path does not sit in.
	const recordedPlan = toRepoRelativePath({ cwd, path: plan });
	const planName = await planNameFromPath({ cwd, planPath: recordedPlan });
	const branch = await readGitCurrentBranch({ cwd });
	const manifest: RunManifest = {
		runId: runId ?? randomUUID(),
		createdAt: now,
		updatedAt: now,
		plan: recordedPlan,
		planName,
		pipeline,
		ticketRef,
		overview: overview === undefined ? undefined : toRepoRelativePath({ cwd, path: overview }),
		parentRunId,
		harness: driver,
		config: loadedConfig?.config,
		branch,
		// Absolute, because the reader that wants it stands in another checkout
		// and has nothing to join a relative path onto.
		workspace: resolve(cwd),
		configPath: loadedConfig?.path,
		willShip,
		status: RunStatus.Pending,
		currentStep: null,
		steps: [],
		changedFiles: [],
		commits: [],
		packages: [],
		baselineDirtyFiles: baselineDirtyFiles ?? [],
		testSubjects: [],
		acceptanceTests: [],
		approvedTests: [],
		unreachableChangedFiles: [],
		coverageExcludedChangedFiles: [],
	};

	// `ticketRef` is set by exactly one pipeline — direct — and a direct run of a
	// ticket is built on that ticket's branch, which is the ticket folder's name
	// by construction. A run with no ticket to file under lands in the command's
	// own folder instead.
	const runDir = await resolveNewRunDir({
		cwd,
		planName,
		workOrderName: planName === undefined && ticketRef !== undefined ? branch : undefined,
		pipeline,
		runId: manifest.runId,
	});

	// The order is load-bearing: `writeRunManifest` resolves its path through a
	// lookup that throws for a run the index has never seen, so recording after
	// the write would fail every run at creation.
	await mkdir(runDir, { recursive: true });
	runDirectoryIndex.record({ cwd, runId: manifest.runId, runDir });
	const written = await writeRunManifest({ cwd, manifest });

	// After the manifest, never before, so a reader that finds the owner record
	// can count on the manifest. A phase child gets none: its coordinator's
	// record answers for the whole family.
	if (parentRunId === undefined) {
		await writeRunOwner({ cwd, runId: manifest.runId, queueRunId });
	}

	return written;
};
