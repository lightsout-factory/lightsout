import { readOptionalConfig } from '#src/common/config/readOptionalConfig.ts';
import { parsePlanAddress } from '#src/common/planAddress/parsePlanAddress.ts';
import { workOrderNameOf } from '#src/common/planAddress/workOrderNameOf.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import { pathExists } from '#src/plan/common/paths/pathExists.ts';
import { planNameFromPath } from '#src/plan/planNameFromPath.ts';
import { planWorkspaceDir } from '#src/plan/planWorkspaceDir.ts';
import { readPlanWorkOrderRef } from '#src/plan/readPlanWorkOrderRef.ts';
import { resolveTrackerSettings } from '#src/ticketTracker/resolveTrackerSettings.ts';
import { pullWorkOrderState } from '#src/workOrder/pullWorkOrderState.ts';
import { restoreWorkOrderPlan } from '#src/workOrder/restoreWorkOrderPlan.ts';
import { resolveWorktreePath } from '#src/worktree/resolveWorktreePath.ts';

interface Params {
	cwd: string;
	/** The --plan value exactly as the user gave it. */
	planPath: string;
	/** Where the "fetched from the ticket" line goes — stdout by default, so a test reads what was printed. */
	write?: (line: string) => void;
}

interface TicketSource {
	config: LightsoutConfig;
	/** The ticket reference the work order's record carries, e.g. 'lo-54'. */
	identifier: string;
}

/**
 * Every sentence names the missing folder first, because that is the problem
 * the user is looking at; the tracker is only why it could not be solved.
 */
const readTicketSource = async ({ cwd, name, dir }: { cwd: string; name: string; dir: string }): Promise<TicketSource | { error: string }> => {
	// Unguarded: a config the engine cannot parse must fail loudly here, exactly
	// as it does for every other `implement` step.
	const config = await readOptionalConfig({ cwd });

	if (config === undefined) {
		return { error: `no plan at ${dir}, and no plan could be fetched from the ticket: this repo has no lightsout.config.json, so it names no ticket tracker` };
	}

	const settings = resolveTrackerSettings({ config, env: process.env });

	if ('error' in settings) {
		return { error: `no plan at ${dir}, and no plan could be fetched from the ticket: ${settings.error}` };
	}

	const identifier = await readPlanWorkOrderRef({ cwd, name });

	return identifier === undefined
		? {
				error: `no plan at ${dir}, and no plan could be fetched from a ticket: work order '${workOrderNameOf({ name })}' carries no ticket reference in its record, so it belongs to no ticket`,
			}
		: { config, identifier };
};

/**
 * A record this machine cannot settle — one that moved here and on the ticket —
 * stops the run, because a plan restored under it could be from either side of
 * the divergence.
 */
const fetchTicketPlan = async ({
	cwd,
	name,
	dir,
	tree,
	identifier,
	config,
	write,
}: {
	cwd: string;
	name: string;
	dir: string;
	tree: string;
	identifier: string;
	config: LightsoutConfig;
	write: (line: string) => void;
}) => {
	const workOrderName = workOrderNameOf({ name });
	const pulled = await pullWorkOrderState({ cwd, name: workOrderName, config, env: process.env, onProgress: write });

	if ('error' in pulled) {
		return { error: `no plan at ${dir}, and the ticket record for '${workOrderName}' could not be settled: ${pulled.error}` };
	}

	const restored = await restoreWorkOrderPlan({ cwd, address: name, config, env: process.env, onProgress: write });

	if ('error' in restored) {
		return { error: `no plan at ${dir}, and the plan attachments on ticket ${identifier} could not be restored: ${restored.error}` };
	}

	if (restored.restored.length === 0) {
		return {
			error: `no plan at ${dir} or in the plan's worktree at ${tree}, and ticket ${identifier} carries no attachment for that plan — run \`lightsout plan publish --name ${name}\` from the machine that has the plan`,
		};
	}

	write(`lightsout: fetched ${restored.restored.length} plan file(s) from ticket ${identifier} into ${dir}`);

	return undefined;
};

/**
 * Local disk wins outright, so a repo that commits its plan folders works with
 * no tracker at all: a folder already there is never overwritten, merged into
 * or deleted.
 *
 * The fetch is here, at the command edge, rather than inside
 * `resolvePlanDeliverable`: that resolver is shared by the read-only `plan
 * dedup` and `plan grade` passes, which must not reach the tracker unannounced.
 */
export const ensurePlanWorkspace = async ({ cwd, planPath, write = console.log }: Params): Promise<{ error: string } | undefined> => {
	const name = await planNameFromPath({ cwd, planPath });

	if (name === undefined) {
		return undefined;
	}

	const dir = await planWorkspaceDir({ cwd, name });

	if (await pathExists({ path: dir })) {
		return undefined;
	}

	// Before the ticket source is read, so nothing about the tracker or the work
	// order's record may refuse a path that is not a plan address.
	if (parsePlanAddress({ name }) === undefined) {
		return undefined;
	}

	const source = await readTicketSource({ cwd, name, dir });

	if ('error' in source) {
		return source;
	}

	const { config, identifier } = source;

	return fetchTicketPlan({ cwd, name, dir, tree: await resolveWorktreePath({ cwd, branch: workOrderNameOf({ name }) }), identifier, config, write });
};
