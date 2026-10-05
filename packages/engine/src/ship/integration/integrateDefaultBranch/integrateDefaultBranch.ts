import { messageOf } from '#src/common/messageOf.ts';
import type { ShipIntegration } from '#src/common/types/ShipIntegration.ts';
import { ShipBlockReason } from '#src/contracts/ship/ShipBlockReason.ts';
import { runGit } from '#src/ship/common/runGit.ts';
import { hasOpenMerge } from '#src/ship/integration/integrateDefaultBranch/common/hasOpenMerge.ts';
import { readConflictMarkerPaths } from '#src/ship/integration/integrateDefaultBranch/common/readConflictMarkerPaths.ts';
import { readUnmergedPaths } from '#src/ship/integration/integrateDefaultBranch/common/readUnmergedPaths.ts';
import type { IntegrationFailure } from '#src/ship/integration/integrateDefaultBranch/common/types/IntegrationFailure.ts';
import { mergeDefaultBranch } from '#src/ship/integration/integrateDefaultBranch/mergeDefaultBranch/mergeDefaultBranch.ts';
import { repairCiFailure } from '#src/ship/integration/integrateDefaultBranch/repairCiFailure.ts';
import { repairIntegratedGates } from '#src/ship/integration/integrateDefaultBranch/repairIntegratedGates.ts';
import { resolveMergeConflicts } from '#src/ship/integration/integrateDefaultBranch/resolveMergeConflicts.ts';
import { restorePreIntegrationState } from '#src/ship/integration/integrateDefaultBranch/restorePreIntegrationState.ts';
import { resolveStandards } from '#src/standards/resolveStandards.ts';

interface Params {
	cwd: string;
	integration: ShipIntegration;
	branch: string;
	defaultBranch: string;
	/** The commit `HEAD` was at before anything was integrated — where an exhausted recovery puts the branch back. */
	baselineCommit: string;
	/** The configured release command, run by the verification step against the pinned base. */
	preShip: string | undefined;
	/** The failing remote run's own output, when this attempt is meant to repair a demonstrated defect. */
	ciEvidence?: string;
	/** The branch's own diff against the commit it was cut from, captured once and unchanged across retries. */
	branchDiff?: string;
	ticketRef?: string;
	onProgress?: (message: string) => void;
}

type Ownership = { owned: true } | { owned: false; detail: string };

interface GuardContext {
	cwd: string;
	branch: string;
	baselineCommit: string;
	onProgress?: (message: string) => void;
}

const readOwnership = async ({ cwd, branch, baselineCommit }: { cwd: string; branch: string; baselineCommit: string }): Promise<Ownership> => {
	const current = await runGit({ command: 'git rev-parse --abbrev-ref HEAD', cwd });
	const head = await runGit({ command: 'git rev-parse HEAD', cwd });

	if (current === undefined || current.exitCode !== 0 || head === undefined || head.exitCode !== 0) {
		return { owned: false, detail: 'git could not say which branch and commit the checkout is on' };
	}

	if (current.stdout.trim() !== branch) {
		return { owned: false, detail: `the checkout is on '${current.stdout.trim()}' rather than '${branch}'` };
	}

	return head.stdout.trim() === baselineCommit
		? { owned: true }
		: { owned: false, detail: `HEAD is at ${head.stdout.trim()} rather than the recorded baseline ${baselineCommit}` };
};

/**
 * A rollback is mandatory before a push and destructive by nature, so it never
 * runs against git state that changed hands — work that took the branch's place
 * is somebody's, and destroying it to tidy up would be the worst outcome of the
 * two. A restoration that itself fails is stated beside the original cause
 * rather than replacing it, and the branch is never reported clean.
 */
const guardedStop = async ({ context, failure }: { context: GuardContext; failure: IntegrationFailure }): Promise<IntegrationFailure> => {
	const { cwd, branch, baselineCommit, onProgress } = context;
	const ownership = await readOwnership({ cwd, branch, baselineCommit });

	if (!ownership.owned) {
		return { ...failure, detail: `${failure.detail}\ngit state this ship no longer owns was left untouched: ${ownership.detail}` };
	}

	const restoreFailure = await restorePreIntegrationState({ cwd, baselineCommit, onProgress });

	return restoreFailure === undefined ? failure : { ...failure, detail: `${failure.detail}\nrestoring the pre-integration branch failed: ${restoreFailure}` };
};

const loadStandards = async ({ cwd, integration }: Pick<Params, 'cwd' | 'integration'>): Promise<{ standards?: string; error?: string }> => {
	try {
		const { standards } = await resolveStandards({ cwd, config: integration.config });

		return { standards };
	} catch (error) {
		return { error: `the repository's standards could not be loaded: ${messageOf({ error })}` };
	}
};

/** Read from git rather than from the agent's report. */
const readUnsettled = async ({ cwd }: { cwd: string }): Promise<{ paths: string[]; error?: string }> => {
	const unmerged = await readUnmergedPaths({ cwd });
	const marked = await readConflictMarkerPaths({ cwd });

	if (unmerged === undefined || marked === undefined) {
		return { paths: [], error: 'git could not be read for unmerged paths and conflict markers' };
	}

	return { paths: [...new Set([...unmerged, ...marked])] };
};

/** `--no-edit` while this attempt's merge is still open, so the commit is the merge commit git wrote the message for. */
const commitVerifiedTree = async ({ context }: { context: GuardContext }) => {
	const { cwd, onProgress } = context;
	const staged = await runGit({ command: 'git add -A', cwd });

	if (staged === undefined || staged.exitCode !== 0) {
		return guardedStop({ context, failure: { reason: ShipBlockReason.IntegrationUnavailable, detail: 'git could not stage the verified tree', paths: [] } });
	}

	const merging = await hasOpenMerge({ cwd });
	const status = await runGit({ command: 'git status --porcelain', cwd });

	if (status === undefined || status.exitCode !== 0) {
		const detail = 'git could not read the tree it was about to commit';

		return guardedStop({ context, failure: { reason: ShipBlockReason.IntegrationUnavailable, detail, paths: [] } });
	}

	if (!merging && status.stdout.trim() === '') {
		return undefined;
	}

	const command = merging ? 'git commit -q --no-edit' : `git commit -q -m 'ship: verified release candidate'`;
	const committed = await runGit({ command, cwd });

	if (committed === undefined || committed.exitCode !== 0) {
		const detail = `git could not commit the verified tree: ${(committed?.stderr ?? 'git did not answer').trim()}`;

		return guardedStop({ context, failure: { reason: ShipBlockReason.IntegrationUnavailable, detail, paths: [] } });
	}

	onProgress?.('integrate: committed the verified integration');

	return undefined;
};

const recoverCandidate = async ({
	params,
	standards,
	baseCommit,
	conflictPaths,
}: {
	params: Params;
	standards?: string;
	baseCommit: string;
	conflictPaths: string[];
}) => {
	const { cwd, integration, branch, defaultBranch, preShip, ciEvidence, branchDiff, ticketRef, onProgress } = params;

	if (conflictPaths.length > 0) {
		const failure = await resolveMergeConflicts({ cwd, integration, branch, defaultBranch, standards, conflictPaths, onProgress });

		if (failure !== undefined) {
			return failure;
		}
	}

	if (ciEvidence !== undefined && branchDiff !== undefined && ticketRef !== undefined) {
		const failure = await repairCiFailure({ cwd, integration, branch, defaultBranch, ticketRef, branchDiff, ciEvidence, standards, onProgress });

		if (failure !== undefined) {
			return failure;
		}
	}

	return repairIntegratedGates({ cwd, integration, branch, defaultBranch, standards, preShip, baseCommit, onProgress });
};

/**
 * Nothing is committed before the gates are green, so an exhausted recovery
 * stays reversible and nothing unverified can reach the remote. A branch the
 * default branch is already an ancestor of still runs every gate: standalone
 * ship has no proof of prior verification, and the release hook may change the
 * candidate tree either way.
 *
 * Every expected failure after the merge began — git, standards, gates, the
 * harness, staging, the commit itself — leaves through one guarded path that
 * checks this attempt still owns the branch before it restores anything.
 *
 * @returns undefined when the branch is integrated, verified and committed, else why it is not
 */
export const integrateDefaultBranch = async (params: Params): Promise<IntegrationFailure | undefined> => {
	const { cwd, integration, branch, defaultBranch, baselineCommit, onProgress } = params;
	const context: GuardContext = { cwd, branch, baselineCommit, onProgress };
	const outcome = await mergeDefaultBranch({ cwd, defaultBranch, onProgress });

	if (outcome.failure !== undefined || outcome.baseCommit === undefined) {
		const failure = { reason: ShipBlockReason.IntegrationUnavailable, detail: outcome.failure ?? `git could not name origin/${defaultBranch}`, paths: [] };

		return outcome.integrated ? guardedStop({ context, failure }) : failure;
	}

	const loaded = await loadStandards({ cwd, integration });

	if (loaded.error !== undefined) {
		return guardedStop({ context, failure: { reason: ShipBlockReason.IntegrationUnavailable, detail: loaded.error, paths: [] } });
	}

	const recovery = await recoverCandidate({ params, standards: loaded.standards, baseCommit: outcome.baseCommit, conflictPaths: outcome.conflictPaths });

	if (recovery !== undefined) {
		return guardedStop({ context, failure: recovery });
	}

	const ownership = await readOwnership({ cwd, branch, baselineCommit });

	if (!ownership.owned) {
		const detail = `the integration finished against git state this ship no longer owns: ${ownership.detail}`;

		return { reason: ShipBlockReason.IntegrationUnavailable, detail, paths: [] };
	}

	const unsettled = await readUnsettled({ cwd });

	if (unsettled.error !== undefined) {
		return guardedStop({ context, failure: { reason: ShipBlockReason.IntegrationUnavailable, detail: unsettled.error, paths: [] } });
	}

	if (unsettled.paths.length > 0) {
		const detail = `the verified tree still carries unresolved conflicts: ${unsettled.paths.join(', ')}`;

		return guardedStop({ context, failure: { reason: ShipBlockReason.IntegrationConflict, detail, paths: unsettled.paths } });
	}

	return commitVerifiedTree({ context });
};
