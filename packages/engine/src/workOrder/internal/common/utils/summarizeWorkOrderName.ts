import { buildWorkOrderNameInvocation } from '#src/agents/buildWorkOrderNameInvocation.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import { messageOf } from '#src/common/utils/messageOf.ts';
import { toBranchSlug } from '#src/common/utils/toBranchSlug.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { Permissions } from '#src/contracts/Permissions.ts';
import { WorkOrderName } from '#src/contracts/work/WorkOrderName.ts';
import { getDriver } from '#src/drivers/getDriver/getDriver.ts';
import { invokeAgentWithContract } from '#src/invoke/invokeAgentWithContract/invokeAgentWithContract.ts';

interface Params {
	/** The checkout the harness is spawned in. The call reads nothing from it, but every spawn needs a working directory. */
	cwd: string;
	/** The tracker's own spelling. */
	ticketRef: string;
	title: string;
	config: LightsoutConfig;
	/** Test seam for the one agent call — defaults to the harness the config names. */
	driver?: Driver;
	onProgress?: (message: string) => void;
}

/** The ceiling is long enough for a few words from a cold harness, short enough that a hang never holds the command. */
const readSummary = async ({
	cwd,
	ticketRef,
	title,
	config,
	driver,
}: {
	cwd: string;
	ticketRef: string;
	title: string;
	config: LightsoutConfig;
	driver?: Driver;
}) => {
	const timeoutMs = 120_000;

	try {
		return await invokeAgentWithContract({
			driver: driver ?? getDriver({ name: config.harness ?? 'claude-code' }),
			cwd,
			invocation: buildWorkOrderNameInvocation({ ticketRef, title }),
			contract: WorkOrderName,
			model: config.model,
			effort: config.effort,
			permissions: Permissions.ReadOnly,
			timeoutMs,
		});
	} catch (error) {
		return { ok: false as const, failure: messageOf({ error }) };
	}
};

/**
 * Never fails: any failure falls back to a mechanical cut of the title, since
 * refusing to create a work order over a label would be worse.
 */
export const summarizeWorkOrderName = async ({ cwd, ticketRef, title, config, driver, onProgress }: Params): Promise<string> => {
	onProgress?.(`summarising the title of ${ticketRef} into a work order name`);

	const outcome = await readSummary({ cwd, ticketRef, title, config, driver });
	let words = toBranchSlug({ text: title });

	if (outcome.ok) {
		words = outcome.report.words;
	} else {
		onProgress?.(`the harness did not name this work (${outcome.failure}) — using '${words}', cut mechanically from the ticket's title`);
	}

	return words;
};
