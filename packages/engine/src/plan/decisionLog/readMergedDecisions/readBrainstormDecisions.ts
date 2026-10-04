import { join } from 'node:path';
import { pathExists } from '#src/common/pathExists.ts';
import { BrainstormDecisions } from '#src/contracts/plan/decisions/BrainstormDecisions.ts';
import { readPlanWorkspaceFile } from '#src/plan/common/readPlanWorkspaceFile.ts';
import { planWorkspaceDir } from '#src/plan/planWorkspaceDir.ts';

const brainstormDecisionsFile = 'brainstorm-decisions.json';

interface Params {
	cwd: string;
	/** Kebab plan name — the workspace key. */
	name: string;
}

/**
 * A missing file is normal, because most plans never went through
 * `/brainstorm`. A malformed one throws, because drafting on without decisions
 * the user settled would re-open them for no reason.
 */
export const readBrainstormDecisions = async ({ cwd, name }: Params): Promise<BrainstormDecisions | undefined> => {
	const filePath = join(await planWorkspaceDir({ cwd, name }), brainstormDecisionsFile);
	const present = await pathExists({ path: filePath });

	if (!present) {
		return undefined;
	}

	return readPlanWorkspaceFile({
		cwd,
		name,
		fileName: brainstormDecisionsFile,
		schema: BrainstormDecisions,
		notFound: (path) => `brainstorm decisions for plan ${name} at ${path} became unreadable during drafting`,
	});
};
