import { PlanFacts } from '#src/contracts/plan/facts/PlanFacts.ts';
import { readPlanWorkspaceFile } from '#src/plan/common/readPlanWorkspaceFile.ts';

interface Params {
	cwd: string;
	/** Kebab plan name — the workspace key. */
	name: string;
}

export const readPlanFacts = async ({ cwd, name }: Params): Promise<PlanFacts> => {
	return readPlanWorkspaceFile({
		cwd,
		name,
		fileName: 'facts.json',
		schema: PlanFacts,
		notFound: (filePath) =>
			`no facts found for plan ${name} at ${filePath} — author facts.json ({ request, areas }), then run: lightsout plan verify-facts --name ${name}`,
	});
};
