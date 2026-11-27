import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { parsePlanAddress } from '#src/common/planAddress/parsePlanAddress/parsePlanAddress.ts';
import { workOrderNameOf } from '#src/common/planAddress/workOrderNameOf.ts';
import { DedupReport } from '#src/contracts/dedup/DedupReport.ts';
import { BrainstormDecisions } from '#src/contracts/plan/decisions/BrainstormDecisions.ts';
import { DecisionsRecord } from '#src/contracts/plan/decisions/DecisionsRecord.ts';
import { PlanFacts } from '#src/contracts/plan/facts/PlanFacts.ts';
import { GradeReport } from '#src/contracts/plan/grade/GradeReport.ts';
import { PlanningProgress } from '#src/contracts/plan/progress/PlanningProgress.ts';
import type { PlanWorkspaceFile } from '#src/contracts/views/planWorkspace/PlanWorkspaceFile.ts';
import type { PlanWorkspaceListing } from '#src/contracts/views/planWorkspace/PlanWorkspaceListing.ts';
import type { PlanWorkspaceView } from '#src/contracts/views/planWorkspace/PlanWorkspaceView.ts';
import { planWorkspaceDir } from '#src/plan/planWorkspaceDir.ts';
import { buildPlanningStepRows } from '#src/plan/progress/buildPlanningStepRows.ts';
import { isPlanningStepLive } from '#src/plan/progress/isPlanningStepLive.ts';
import { buildPlanWorkspaceListing } from '#src/views/common/buildPlanWorkspaceListing.ts';
import { matchPlanRuns } from '#src/views/common/matchPlanRuns.ts';
import { readPlanWorkspaceFiles } from '#src/views/common/readPlanWorkspaceFiles.ts';
import type { PlanWorkspaceFiles } from '#src/views/common/types/PlanWorkspaceFiles.ts';
import { readGradeTrail } from '#src/views/getPlanWorkspace/readGradeTrail.ts';
import { readPlanRecord } from '#src/views/getPlanWorkspace/readPlanRecord.ts';
import { listRuns } from '#src/views/listRuns.ts';
import { PlanWorkspaceNotFoundError } from '#src/views/PlanWorkspaceNotFoundError.ts';

const escapesFolder = ({ segment }: { segment: string }) => segment === '' || segment === '..' || segment.includes('/') || segment.includes('\\');

/**
 * A name must be a plan address whose work order is one folder name, so nothing
 * outside the plans folder can be opened.
 */
const addressesAPlan = ({ name }: { name: string }) => {
	const address = parsePlanAddress({ name });

	return address !== undefined && !escapesFolder({ segment: address.workOrderName });
};

/**
 * Not `readPlanFacts` and its siblings: they throw on a missing or corrupt file,
 * which is right for a pipeline and wrong for a viewer of a half-finished workspace.
 */
const readRecords = async ({ rootPath, files }: { rootPath: string; files: PlanWorkspaceFiles }) => {
	const [facts, decisions, brainstormDecisions, grade, dedup] = await Promise.all([
		readPlanRecord({ dir: rootPath, file: files.others.get('facts.json'), schema: PlanFacts }),
		readPlanRecord({ dir: rootPath, file: files.others.get('decisions.json'), schema: DecisionsRecord }),
		readPlanRecord({ dir: rootPath, file: files.others.get('brainstorm-decisions.json'), schema: BrainstormDecisions }),
		readPlanRecord({ dir: rootPath, file: files.others.get('grade.json'), schema: GradeReport }),
		readPlanRecord({ dir: rootPath, file: files.others.get('dedup.json'), schema: DedupReport }),
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

/** One markdown file's text, or a line naming it when it cannot be read. */
const readDocument = async ({ rootPath, file }: { rootPath: string; file: PlanWorkspaceFile | undefined }) => {
	if (file === undefined) {
		return { text: undefined, problem: undefined };
	}

	const text = await readFile(join(rootPath, file.name), 'utf8').catch(() => undefined);

	return { text, problem: text === undefined ? `${file.name} could not be read` : undefined };
};

/** Ordered by the number the file name carries, so an archived phase sits where it was planned. */
const readPhases = async ({ rootPath, files }: { rootPath: string; files: PlanWorkspaceFiles }) => {
	const archivePrefix = 'implemented/';
	const listed = [...files.phaseFiles, ...files.implementedFiles].map((file) => {
		const implemented = file.name.startsWith(archivePrefix);
		const name = implemented ? file.name.slice(archivePrefix.length) : file.name;

		return { file, name, implemented, order: Number(/^phase(\d+)-/.exec(name)?.[1]) };
	});
	const read = await Promise.all(
		listed
			.sort((first, second) => first.order - second.order)
			.map(async ({ file, name, implemented }) => {
				const { text, problem } = await readDocument({ rootPath, file });

				return { phase: { name, text: text ?? '', implemented }, problem };
			}),
	);

	return { phases: read.map((entry) => entry.phase), problems: read.flatMap((entry) => (entry.problem === undefined ? [] : [entry.problem])) };
};

/** An absent or unreadable record leaves every step unrun; one clock reading times every running step. */
const readPlanning = async ({ rootPath, files }: { rootPath: string; files: PlanWorkspaceFiles }) => {
	const { value, problem } = await readPlanRecord({ dir: rootPath, file: files.others.get('planning-progress.json'), schema: PlanningProgress });
	const steps = value?.steps ?? [];
	const live = steps.filter((step) => isPlanningStepLive({ step }));

	return { planningSteps: buildPlanningStepRows({ steps, live, nowMs: Date.now() }), planningLive: live.length > 0, problem };
};

/** The texts a reader pages through, each read from the workspace folder itself. */
const readDocuments = async ({ rootPath, files }: { rootPath: string; files: PlanWorkspaceFiles }) => {
	const [plan, notes, { phases, problems }] = await Promise.all([
		readDocument({ rootPath, file: files.planFile }),
		readDocument({ rootPath, file: files.notesFile }),
		readPhases({ rootPath, files }),
	]);

	return {
		planText: plan.text,
		notesText: notes.text,
		phases,
		problems: [plan.problem, notes.problem, ...problems].filter((problem) => problem !== undefined),
	};
};

interface Params {
	cwd: string;
	name: string;
}

/**
 * @param name - the plan's address as the URL carried it: `<work-order>/<plan-id>`
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
	// Every read goes through `rootPath`, the primary checkout's folder, so a
	// linked worktree reads the same workspace the pipeline wrote.
	const { facts, decisions, brainstormDecisions, grade, dedup, problems } = await readRecords({ rootPath, files });
	const planning = await readPlanning({ rootPath, files });
	const documents = await readDocuments({ rootPath, files });
	const gradeTrail = await readGradeTrail({ rootPath, files });
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
		problems: [...problems, planning.problem, gradeTrail.problem, ...documents.problems].filter((problem) => problem !== undefined),
		planText: documents.planText,
		notesText: documents.notesText,
		phases: documents.phases,
		planningSteps: planning.planningSteps,
		planningLive: planning.planningLive,
		gradePasses: gradeTrail.gradePasses,
		gradeFindings: gradeTrail.gradeFindings,
	};
};
