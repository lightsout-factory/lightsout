import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { messageOf } from '#src/common/utils/messageOf.ts';
import { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';

interface Params {
	/** In the primary checkout's work order folder. */
	statePath: string;
	/** The record must name this as its own. */
	name: string;
}

const readText = async ({ statePath }: { statePath: string }) => {
	let outcome: { text: string } | { missing: true } | { error: string };

	try {
		outcome = { text: await readFile(statePath, 'utf8') };
	} catch (error) {
		const missing = typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';

		outcome = missing ? { missing: true } : { error: `the work order state ${statePath} could not be read: ${messageOf({ error })}` };
	}

	return outcome;
};

const readStateText = ({ text, statePath, name }: { text: string; statePath: string; name: string }) => {
	let value: unknown;
	let outcome: { record: WorkOrderState } | { error: string } | undefined;

	try {
		value = JSON.parse(text);
	} catch (error) {
		outcome = { error: `the work order state ${statePath} is not valid JSON: ${messageOf({ error })}` };
	}

	if (outcome === undefined) {
		const parsed = WorkOrderState.safeParse(value);

		if (!parsed.success) {
			outcome = { error: `the work order state ${statePath} does not match the work order state contract: ${z.prettifyError(parsed.error)}` };
		} else if (parsed.data.name !== name) {
			outcome = { error: `the work order state ${statePath} names work order '${parsed.data.name}', not the '${name}' folder it sits in` };
		} else {
			outcome = { record: parsed.data };
		}
	}

	return outcome;
};

/**
 * Only a missing file answers `{ record: undefined }`: readers take that to mean
 * no work order was started, so a corrupt or mismatched file must be an error
 * rather than make a started work order look unstarted.
 */
export const readWorkOrderStateFile = async ({ statePath, name }: Params): Promise<{ record: WorkOrderState | undefined } | { error: string }> => {
	const read = await readText({ statePath });
	let outcome: { record: WorkOrderState | undefined } | { error: string };

	if ('error' in read) {
		outcome = read;
	} else if ('missing' in read) {
		outcome = { record: undefined };
	} else {
		outcome = readStateText({ text: read.text, statePath, name });
	}

	return outcome;
};
