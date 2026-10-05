import { WorkOrderShipStateKind } from '#src/common/constants/WorkOrderShipStateKind.ts';
import type { GitIdentity } from '#src/common/types/GitIdentity.ts';
import type { WorkOrderStateChange } from '#src/common/types/WorkOrderStateChange.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { WorkOrderEventKind } from '#src/contracts/workOrder/WorkOrderEventKind.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import { appendWorkOrderEvent } from '#src/workOrder/common/appendWorkOrderEvent.ts';
import { requireWorkOrderState } from '#src/workOrder/common/state/requireWorkOrderState.ts';
import { updateSyncedWorkOrderState } from '#src/workOrder/common/state/updateSyncedWorkOrderState.ts';
import { readWorkOrderShipState } from '#src/workOrder/shipping/readWorkOrderShipState.ts';

interface Params {
	/** Any checkout of the repository: the one record this machine holds is found from it. */
	cwd: string;
	/** The work order's label, as resolveWorkOrderNameForBranch answered it. */
	name: string;
	/** The branch being shipped, named in the history event. */
	branch: string;
	/** Who is authorizing, as git's effective config in the ship's checkout answers it. */
	identity: GitIdentity;
	config: LightsoutConfig;
	env: NodeJS.ProcessEnv;
	onProgress?: (message: string) => void;
}

/** Either the record to write, or why the record is kept exactly as it is. */
type Decision = { record: WorkOrderState } | { kept: string } | { error: string };

/** Asked only on the path that writes, so a retry or a passed build never needs an identity. */
const recordAuthorization = ({ record, name, branch, identity }: { record: WorkOrderState; name: string; branch: string; identity: GitIdentity }) => {
	if (identity.name === undefined || identity.email === undefined) {
		const unset = [...(identity.name === undefined ? ['user.name'] : []), ...(identity.email === undefined ? ['user.email'] : [])];
		const commands = unset.map((key) => `\`git config ${key} <value>\``);

		return {
			error: `git's ${unset.join(' and ')} ${unset.length === 1 ? 'is' : 'are'} unset in this checkout, so nobody can be recorded as authorizing hand-built work on work order ${name} — set ${unset.length === 1 ? 'it' : 'them'} with ${commands.join(' and ')}`,
		};
	}

	const by = `${identity.name} ${identity.email}`;
	const at = new Date().toISOString();

	return {
		record: appendWorkOrderEvent({
			record: { ...record, handBuiltShipAuthorization: { by, at } },
			kind: WorkOrderEventKind.HandBuiltShipAuthorized,
			detail: `${by} authorized shipping the hand-built work on branch ${branch} as work order ${name}`,
			at,
		}),
	};
};

/** Decided from the ship state's kind alone, never from the record's fields, so it cannot disagree with the ship guard. */
const decideAuthorization = ({ record, name, branch, identity }: { record: WorkOrderState; name: string; branch: string; identity: GitIdentity }) => {
	const state = readWorkOrderShipState({ record });
	let decision: Decision;

	if (state.kind === WorkOrderShipStateKind.TicketBodyPassed) {
		decision = {
			kept: `the build from the ticket body of work order ${name} under run ${state.runId} already passed, so there is no hand-built work to authorize and nothing was recorded`,
		};
	} else if (state.kind === WorkOrderShipStateKind.HandBuiltAuthorized) {
		decision = { kept: `${state.by} already authorized shipping hand-built work on work order ${name} at ${state.at}, so that authorization is kept` };
	} else if (state.kind === WorkOrderShipStateKind.ShipRequestMissing || state.kind === WorkOrderShipStateKind.ShipRequested) {
		decision = {
			error: `work order ${name} is in multiple-plan mode, where it ships on a ship request rather than on hand-built work — ask for one with \`lightsout work-order request-ship --name ${name} --plans <id,id>\``,
		};
	} else if (
		state.kind === WorkOrderShipStateKind.TicketBodyUnbuilt ||
		state.kind === WorkOrderShipStateKind.TicketBodyBuilding ||
		state.kind === WorkOrderShipStateKind.TicketBodyFailed
	) {
		decision = recordAuthorization({ record, name, branch, identity });
	} else {
		// The plan 001 kinds: a shipped record never reaches here, because requireWorkOrderState refused it.
		decision = {
			error: `work order ${name} holds plan 001, and a single-plan work order holding plan 001 ships through that plan alone, so there is no hand-built work to authorize — ship it through plan 001 instead`,
		};
	}

	return decision;
};

/**
 * Records a person's authorization to ship work built by hand on a single-plan work order holding
 * no plan 001. Everything is decided inside the store's change callback, so a refusal leaves the
 * record's bytes untouched, and a record that cannot be pulled is a refusal: a record that cannot
 * be established cannot authorize. Only `lightsout ship --hand-built` calls it, so no engine path
 * can give the authorization on its own.
 */
export const authorizeHandBuiltShip = async ({
	cwd,
	name,
	branch,
	identity,
	config,
	env,
	onProgress,
}: Params): Promise<WorkOrderStateChange | { error: string }> => {
	let kept: string | undefined;
	const updated = await updateSyncedWorkOrderState({
		cwd,
		name,
		config,
		env,
		onProgress,
		change: (current) => {
			if (current === undefined) {
				return {
					error: `no work order saves branch ${branch}, so there is no hand-built work to authorize — plain \`lightsout ship\` ships a branch no work order claims`,
				};
			}

			const record = requireWorkOrderState({ record: current, name });

			if ('error' in record) {
				return record;
			}

			const decision = decideAuthorization({ record, name, branch, identity });
			let next: WorkOrderState | { error: string };

			if ('kept' in decision) {
				kept = decision.kept;
				next = record;
			} else {
				next = 'error' in decision ? decision : decision.record;
			}

			return next;
		},
	});

	return 'error' in updated ? updated : { record: updated.record, notice: kept, publishError: updated.publishError };
};
