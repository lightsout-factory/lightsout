import { describeUnownedEdits } from '#src/commit/commitRunWork/describeUnownedEdits.ts';
import { readRunCommitAddress } from '#src/commit/commitRunWork/readRunCommitAddress.ts';
import { commitWorkOrderWork } from '#src/commit/commitWorkOrderWork/commitWorkOrderWork.ts';
import type { CommitAddress } from '#src/commit/common/types/CommitAddress.ts';
import { composeCommitMessage } from '#src/commit/composeCommitMessage/composeCommitMessage.ts';
import { readGitHeadCommit } from '#src/common/git/readGitHeadCommit.ts';
import { resolveRunDir } from '#src/common/resolveRunDir.ts';
import { isGeneratedPath } from '#src/common/sourceFiles/isGeneratedPath.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { AgentUsage } from '#src/contracts/run/AgentUsage.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';

/**
 * Structural on purpose: the implement pipeline's `PipelineRun` and the direct
 * pipeline's `RunState` share no declared type.
 */
interface CommittingRun {
	cwd: string;
	config: LightsoutConfig;
	current(): RunManifest;
	progress(message: string): void;
	update({ patch }: { patch: Partial<RunManifest> }): Promise<void>;
	recordUsage({ step, usage }: { step: string; usage?: AgentUsage }): Promise<void>;
}

interface Params {
	run: CommittingRun;
	driver: Driver;
	/** The address a pipeline that builds no plan supplies for itself — the direct run's. Omitted by a plan run, whose address is read from the plan the manifest names. */
	address?: CommitAddress;
	/** Whether this run continues work that was parked — true only for a run that adopted an existing manifest. Only such a run's tree is compared for edits the run does not own; a phase starting for the first time is covered instead by the coordinator's clean-tree check before it starts. */
	resumed: boolean;
	/** Forwarded to `commitWorkOrderWork`: leave generated changes uncommitted on disk instead of discarding them. Set only by a phase of a sequence. Default false. */
	keepGenerated?: boolean;
}

/**
 * Commits before the run is stamped passed, so a long sequence that dies keeps
 * its verified work. With nothing to commit, an empty changed-file list is a
 * silent agent and fails, while a non-empty one means an earlier attempt
 * already committed this unit. The list is filtered through `generated`
 * because the direct pipeline records the worker's report unfiltered.
 *
 * @returns undefined when the work is in history, or the one sentence saying why it is not
 */
export const commitRunWork = async ({ run, driver, address, resumed, keepGenerated = false }: Params): Promise<string | undefined> => {
	const manifest = run.current();
	const generated = run.config.generated ?? [];
	const changed = manifest.changedFiles.filter((path) => !isGeneratedPath({ path, generated }));
	// Before `commitWorkOrderWork`, never after: that function stages with
	// `git add -A`, so a refusal decided afterwards would be decided about a tree
	// already staged.
	const unowned = resumed ? await describeUnownedEdits({ cwd: run.cwd, manifest, generated }) : undefined;

	if (unowned !== undefined) {
		return unowned;
	}

	// Resolved because a run's folder is filed under its ticket. An unreadable
	// checkout refuses to commit rather than crashing.
	let runDir: string;

	try {
		runDir = await resolveRunDir({ cwd: run.cwd, runId: manifest.runId });
	} catch {
		return `${run.cwd} could not be read, so this run's records could not be found — nothing was committed`;
	}

	const onProgress = (message: string) => run.progress(message);
	const resolved = address ?? (await readRunCommitAddress({ cwd: run.cwd, manifest, onProgress }));
	const committed = await commitWorkOrderWork({
		cwd: run.cwd,
		composeMessage: ({ cwd }) =>
			composeCommitMessage({
				cwd,
				driver,
				config: run.config,
				address: resolved,
				runId: manifest.runId,
				onUsage: ({ usage }) => run.recordUsage({ step: 'commit-message', usage }),
				onProgress,
			}),
		runDir,
		generated,
		keepGenerated,
		onProgress,
	});

	if ('error' in committed) {
		return committed.error;
	}

	if (!committed.committed) {
		if (changed.length === 0) {
			return 'the worker changed nothing';
		}

		run.progress('nothing left to commit — this unit’s work is already in the branch’s history');

		return undefined;
	}

	// The subject recorded is the one that landed — the agent's, or the template
	// it fell back to — which only the committed message can say.
	const [subject = ''] = committed.message.split('\n');
	const sha = await readGitHeadCommit({ cwd: run.cwd });

	// Never passed over: the result block reads the recorded commits, so a run
	// that recorded none would report its own work as already in history.
	if (sha === undefined) {
		return `the work in ${run.cwd} was committed but git could not name the commit — resume the run so the tree is checked again`;
	}

	await run.update({ patch: { commits: [...manifest.commits, { sha, subject, runId: manifest.runId }] } });
	run.progress(`committed ${sha.slice(0, 7)} — ${subject}`);

	return undefined;
};
