import { join } from 'node:path';
import { resolveRunDir } from '#src/common/runs/resolveRunDir.ts';

interface Params {
	cwd: string;
	runId: string;
}

/**
 * In the run's own folder rather than the manifest, which is rewritten every
 * step and must not carry thousands of findings, or the repo-level
 * `.lightsout/standards-check.json`, which belongs to the user's standalone
 * check.
 *
 * Not the committed debt ledger `lightsout.standards-baseline.json`: that holds
 * debt already forgiven, while this is the measurement that says which debt is
 * new.
 */
export const getRunStandardsBaselinePath = async ({ cwd, runId }: Params): Promise<string> => {
	return join(await resolveRunDir({ cwd, runId }), 'standards-baseline.json');
};
