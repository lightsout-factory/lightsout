import { DecisionsRecord } from '#src/contracts/plan/decisions/DecisionsRecord.ts';
import { readPlanWorkspaceFile } from '#src/plan/internal/common/utils/readPlanWorkspaceFile.ts';

interface Params {
	cwd: string;
	/** Kebab plan name — the workspace key. */
	name: string;
}

/**
 * A missing or corrupt file is a hard error, because drafting from decisions
 * that were never authored would silently produce a bad plan.
 */
export const readDecisions = async ({ cwd, name }: Params): Promise<DecisionsRecord> => {
	return readPlanWorkspaceFile({
		cwd,
		name,
		fileName: 'decisions.json',
		schema: DecisionsRecord,
		notFound: (filePath) => `no decisions found for plan ${name} at ${filePath} — author decisions.json before drafting`,
	});
};
