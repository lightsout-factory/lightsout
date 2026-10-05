import type { Issue } from '@linear/sdk';
import { collectNodes } from '#src/ticketTracker/linear/common/collectNodes.ts';

interface Params {
	issue: Issue;
}

/** A truncated list could hide a second route label, the case the queue's skip policy exists to catch. */
export const readLabelNames = async ({ issue }: Params): Promise<string[]> => {
	const labels = await collectNodes({ connection: await issue.labels() });

	return labels.map((label) => label.name);
};
