import { stat } from 'node:fs/promises';
import { parsePlanAddress } from '#src/common/planAddress/parsePlanAddress.ts';
import { workOrderNameOf } from '#src/common/planAddress/workOrderNameOf.ts';
import { DedupReport } from '#src/contracts/dedup/DedupReport.ts';
import { BrainstormDecisions } from '#src/contracts/plan/decisions/BrainstormDecisions.ts';
import { DecisionsRecord } from '#src/contracts/plan/decisions/DecisionsRecord.ts';
import { PlanFacts } from '#src/contracts/plan/facts/PlanFacts.ts';
import { GradeReport } from '#src/contracts/plan/grade/GradeReport.ts';
import type { PlanWorkspaceListing } from '#src/contracts/views/planWorkspace/PlanWorkspaceListing.ts';
import type { PlanWorkspaceView } from '#src/contracts/views/planWorkspace/PlanWorkspaceView.ts';
import { planWorkspaceDir } from '#src/plan/planWorkspaceDir.ts';
import type { PlanWorkspaceFiles } from '#src/views/internal/common/types/PlanWorkspaceFiles.ts';
import { buildPlanWorkspaceListing } from '#src/views/internal/common/utils/buildPlanWorkspaceListing.ts';
import { matchPlanRuns } from '#src/views/internal/common/utils/matchPlanRuns.ts';
import { readPlanRecord } from '#src/views/internal/common/utils/readPlanRecord.ts';
import { readPlanWorkspaceFiles } from '#src/views/internal/common/utils/readPlanWorkspaceFiles.ts';
import { listRuns } from '#src/views/listRuns.ts';
import { PlanWorkspaceNotFoundError } from '#src/views/PlanWorkspaceNotFoundError.ts';

/** One path segment that could only address something outside the folder it is joined to. */
const escapesFolder = ({ segment }: { segment: string }) => segment === '' || segment === '..' || segment.includes('/') || segment.includes('\\');

/**
 * Whether a workspace name addresses a plan inside the plans folder — the
 * defence `getPlanDocument` applies to its path.
 *
 * Only a plan address opens a workspace, and its work-order segment is held to
 * a single-segment test, so nothing outside the plans folder can be opened.
 */
const addressesAPlan = ({ name }: { name: string }) => {
	const address = parsePlanAddress({ name });

	return address !== undefined && !escapesFolder({ segment: address.workOrderName });
};

/**
 * Every JSON record the workspace holds, each read leniently.
 *
 * `readPlanFacts` and its siblings are deliberately not used: they throw on a
 * missing or corrupt file, which is correct for a pipeline that must not proceed
 * on half an answer, and wrong for a viewer whose job is to show a half-finished
 * workspace. Each file that exists and will not parse becomes a line instead.
 */
const readRecords = async ({ cwd, files }: { cwd: string; files: PlanWorkspaceFiles }) => {
	const [facts, decisions, brainstormDecisions, grade, dedup] = await Promise.all([
		readPlanRecord({ cwd, file: files.others.get('facts.json'), schema: PlanFacts }),
		readPlanRecord({ cwd, file: files.others.get('decisions.json'), schema: DecisionsRecord }),
		readPlanRecord({ cwd, file: files.others.get('brainstorm-decisions.json'), schema: BrainstormDecisions }),
		readPlanRecord({ cwd, file: files.others.get('grade.json'), schema: GradeReport }),
		readPlanRecord({ cwd, file: files.others.get('dedup.json'), schema: DedupReport }),
	]);

	return {
		facts: facts.value,
		decisions: decisions.value,
		brainstormDecisions: brainstormDecisions.value,
		grade: grade.value,
		dedup: dedup.value,
		problems: [facts, decisions, brainstormDecisions, grade, dedup].flatMap((record) => (record.problem === undefined ? [] : [record.problem])),
	};
};

interface Params {
	cwd: string;
	name: string;
}

/**
 * One plan workspace, whole: its files, its parsed records, and the runs that
 * implemented it.
 *
 * @param cwd - the repo whose `.lightsout/work-orders/` is read
 * @param name - the plan's address, exactly as the URL carried it: `<work-order>/<plan-id>`
 * @throws {PlanWorkspaceNotFoundError} When the name is no plan address, or no plan folder answers to it.
 */
export const getPlanWorkspace = async ({ cwd, name }: Params): Promise<PlanWorkspaceView> => {
	if (!addressesAPlan({ name })) {
		throw new PlanWorkspaceNotFoundError({ name });
	}

	const rootPath = await planWorkspaceDir({ cwd, name });
	const stats = await stat(rootPath).catch(() => undefined);

	if (stats?.isDirectory() !== true) {
		throw new PlanWorkspaceNotFoundError({ name });
	}

	const files = await readPlanWorkspaceFiles({ cwd, name });
	// One ticket's runs folder, kept by the recorded name: no other ticket's runs
	// are opened to answer for this plan.
	const workOrderName = workOrderNameOf({ name });
	const runs = matchPlanRuns({ name, runs: await listRuns({ cwd, workOrderName }) });
	const { facts, decisions, brainstormDecisions, grade, dedup, problems } = await readRecords({ cwd, files });
	const listing: PlanWorkspaceListing = buildPlanWorkspaceListing({
		name,
		files,
		hasGrade: files.others.get('grade.json') !== undefined,
		grade: grade?.grade,
		runs,
	});

	return {
		listing,
		rootPath,
		planFile: files.planFile,
		phaseFiles: files.phaseFiles,
		notesFile: files.notesFile,
		facts,
		decisions,
		brainstormDecisions,
		grade,
		dedup,
		transcripts: files.transcripts,
		runs,
		problems,
	};
};
