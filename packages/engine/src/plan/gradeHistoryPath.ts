import { join } from 'node:path';
import { planWorkspaceDir } from '#src/plan/planWorkspaceDir.ts';

interface Params {
	cwd: string;
	/** Kebab plan name — the folder the plan's own files live in. */
	name: string;
}

/**
 * An append-only ledger of whole `GradeReport`s, one per line, so a human can
 * see a plan go C → B → A. `grade.json` still holds the latest pass and is the
 * file to read for a verdict.
 */
export const gradeHistoryPath = async ({ cwd, name }: Params): Promise<string> => join(await planWorkspaceDir({ cwd, name }), 'grade-history.jsonl');
