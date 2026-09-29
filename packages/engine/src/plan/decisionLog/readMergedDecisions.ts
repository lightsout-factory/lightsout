import type { BrainstormDecisions } from '#src/contracts/plan/decisions/BrainstormDecisions.ts';
import type { DecisionsRecord } from '#src/contracts/plan/decisions/DecisionsRecord.ts';
import { readBrainstormDecisions } from '#src/plan/readBrainstormDecisions.ts';
import { readDecisions } from '#src/plan/readDecisions.ts';

interface Params {
	cwd: string;
	/** Kebab plan name — the folder the plan's own files live in. */
	name: string;
	onProgress?: (message: string) => void;
}

/**
 * Brainstorm rows come first because they were settled first, which is the order
 * supersession resolves against. They are merged at read time so the plan's own
 * `decisions.json` stays plan-owned.
 */
export const readMergedDecisions = async ({
	cwd,
	name,
	onProgress,
}: Params): Promise<{ merged: DecisionsRecord; brainstorm: BrainstormDecisions | undefined }> => {
	const decisions = await readDecisions({ cwd, name });
	const brainstorm = await readBrainstormDecisions({ cwd, name });
	const merged: DecisionsRecord = brainstorm ? { ...decisions, decisions: [...brainstorm.decisions, ...decisions.decisions] } : decisions;

	onProgress?.(
		brainstorm
			? `plan draft ${name}: ${brainstorm.decisions.length} brainstorm decision(s) carried in`
			: `plan draft ${name}: no brainstorm decisions — drafting from the plan's own rows`,
	);

	return { merged, brainstorm };
};
