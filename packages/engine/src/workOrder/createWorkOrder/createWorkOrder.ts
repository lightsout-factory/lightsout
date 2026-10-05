import { renderBranchTemplate } from '#src/common/renderBranchTemplate.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import type { WorkOrderListing } from '#src/common/types/WorkOrderListing.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { WorkOrderMode } from '#src/contracts/workOrder/WorkOrderMode.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import { listWorkOrders } from '#src/workOrder/common/listWorkOrders.ts';
import { updateLocalWorkOrderState } from '#src/workOrder/common/state/updateLocalWorkOrderState.ts';
import { buildWorkOrderState } from '#src/workOrder/createWorkOrder/buildWorkOrderState.ts';
import { composeWorkOrderName } from '#src/workOrder/createWorkOrder/composeWorkOrderName.ts';
import { readTicketTitle } from '#src/workOrder/createWorkOrder/readTicketTitle.ts';
import { summarizeWorkOrderName } from '#src/workOrder/createWorkOrder/summarizeWorkOrderName.ts';
import { findWorkOrderByTicketRef } from '#src/workOrder/findWorkOrderByTicketRef.ts';

interface Params {
	/** Any checkout of the repository: the record is written in its primary checkout. */
	cwd: string;
	/** The ticket this work is for. Exactly one of this and `title` is given. */
	ticketRef?: string;
	/** The words naming this work, taken as handed. Exactly one of this and `ticketRef` is given. */
	title?: string;
	/** The mode the record is created in, overriding `plan.default-work-order-mode`. Absent for `lightsout work-order new`, which keeps the repository default. */
	mode?: WorkOrderMode;
	config: LightsoutConfig;
	env: NodeJS.ProcessEnv;
	/** Test seam relayed to the summariser — defaults to the harness the config names. */
	driver?: Driver;
	onProgress?: (message: string) => void;
}

const namingFlagsRefusal =
	'`lightsout work-order new` names the work exactly once, so give exactly one of --ticket <ref> and --title <words>: --ticket reads the ticket’s title from the tracker and summarises it, and --title takes the words you type.';

/** A label already taken is refused by name rather than suffixed: a silent suffix would be a second author of the name. */
const takenRefusal = ({ name }: { name: string }) =>
	`${name} already names a work order — pass --title <words> to name this one differently, or add a plan to the existing one with \`lightsout work-order add-plan --name ${name}\``;

const resolveNaming = async ({
	cwd,
	ticketRef,
	title,
	config,
	env,
	driver,
	onProgress,
}: Params): Promise<{ ticketRef?: string; words: string } | { error: string }> => {
	if (title !== undefined) {
		return ticketRef === undefined ? { words: title } : { error: namingFlagsRefusal };
	}

	if (ticketRef === undefined) {
		return { error: namingFlagsRefusal };
	}

	const read = await readTicketTitle({ ticketRef, config, env });

	if ('error' in read) {
		return read;
	}

	// Asked before the summariser runs, because the summariser is deliberately
	// not reproducible: two runs on one ticket compose two different labels, so a
	// label check could never catch the second of them.
	const existing = await findWorkOrderByTicketRef({ cwd, ticketRef: read.ticketRef });

	if (existing !== undefined) {
		return {
			error: `work order ${existing.name} already carries ticket ${read.ticketRef} — add a plan to it with \`lightsout work-order add-plan --name ${existing.name}\`, or name genuinely separate work on the same ticket with --title <words>`,
		};
	}

	return { ticketRef: read.ticketRef, words: await summarizeWorkOrderName({ cwd, ticketRef: read.ticketRef, title: read.title, config, driver, onProgress }) };
};

const findAllocationRefusal = ({ listing, name }: { listing: { found: WorkOrderListing[]; unreadable: string[] }; name: string }) => {
	if (listing.unreadable.length > 0) {
		return `these work-order folders could not be read: ${listing.unreadable.join(', ')} — repair or remove them before creating another work order, because a folder the engine cannot read is a work order it cannot see`;
	}

	return listing.found.some((entry) => entry.name === name) ? takenRefusal({ name }) : undefined;
};

/**
 * The label and the branch are stored separately because a branch template with a prefix makes
 * them differ. The record is written locally, not published: creation must not fail on a refused
 * tracker write, and the first `lightsout work-order add-plan` publishes it.
 */
export const createWorkOrder = async ({
	cwd,
	ticketRef,
	title,
	mode,
	config,
	env,
	driver,
	onProgress,
}: Params): Promise<{ name: string; branch: string; record: WorkOrderState } | { error: string }> => {
	const naming = await resolveNaming({ cwd, ticketRef, title, config, env, driver, onProgress });

	if ('error' in naming) {
		return naming;
	}

	const composed = composeWorkOrderName({ ticketRef: naming.ticketRef, words: naming.words });

	if ('error' in composed) {
		return composed;
	}

	// The branch's slug is the SAME words the label carries, never the tracker's
	// sentence-length title: rendering the raw title there would leave the label
	// and the branch different strings under the default template.
	const branch = renderBranchTemplate({ template: config.queue?.['branch-template'] ?? '{ticket}-{slug}', ticketRef: naming.ticketRef, title: naming.words });
	const refusal = findAllocationRefusal({ listing: await listWorkOrders({ cwd }), name: composed.name });

	if (refusal !== undefined) {
		return { error: refusal };
	}

	// The collision is re-asked inside the change, so the record's own lock — and
	// not the look-up above it — is what makes the label unique.
	const written = await updateLocalWorkOrderState({
		cwd,
		name: composed.name,
		change: (current) =>
			current === undefined
				? buildWorkOrderState({ name: composed.name, branch, ticketRef: naming.ticketRef, mode, config })
				: { error: takenRefusal({ name: composed.name }) },
	});

	return 'error' in written ? written : { name: composed.name, branch, record: written.record };
};
