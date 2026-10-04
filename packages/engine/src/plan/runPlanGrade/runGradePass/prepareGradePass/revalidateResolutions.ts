import type { GradeFindingRecord } from '#src/contracts/plan/memory/GradeFindingRecord.ts';
import { GradeFindingStatus } from '#src/contracts/plan/memory/GradeFindingStatus.ts';
import type { GradeMemory } from '#src/contracts/plan/memory/GradeMemory.ts';
import type { DeliverableFile } from '#src/plan/common/types/DeliverableFile.ts';
import { confirmCitation } from '#src/plan/runPlanGrade/runGradePass/common/confirmCitation/confirmCitation.ts';
import { recheckPlanText } from '#src/plan/runPlanGrade/runGradePass/common/recheckPlanText.ts';
import { reopenRecord } from '#src/plan/runPlanGrade/runGradePass/common/reopenRecord.ts';

interface Params {
	cwd: string;
	files: DeliverableFile[];
	overviewText?: string;
	memory: GradeMemory;
	at: string;
}

const firstLostCitation = async ({ params, record }: { params: Params; record: GradeFindingRecord }) => {
	const { cwd, files, overviewText } = params;
	let lost: { phase: string; answerAt: string } | undefined;

	for (const { phase, answerAt } of record.resolutions) {
		const confirmed = await confirmCitation({ cwd, citation: answerAt, planText: recheckPlanText({ files, overviewText, phase }) });

		if (!confirmed.ok) {
			lost = { phase, answerAt };
			break;
		}
	}

	return lost;
};

/**
 * A record resolved at several locations reopens when any one of them is lost: a
 * group whose repair came undone in one place is unresolved as a whole.
 *
 * A `noted` record carries no verified citation, so it is not checked here.
 */
export const revalidateResolutions = async (params: Params): Promise<{ memory: GradeMemory; reopened: string[] }> => {
	const { memory, at } = params;
	const findings: GradeFindingRecord[] = [];
	const reopened: string[] = [];

	for (const record of memory.findings) {
		const lost = record.status === GradeFindingStatus.Resolved ? await firstLostCitation({ params, record }) : undefined;

		if (lost === undefined) {
			findings.push(record);
			continue;
		}

		reopened.push(record.id);
		findings.push(reopenRecord({ record, reason: `resolution citation for ${lost.phase} no longer found in the plan: ${lost.answerAt}`, at }));
	}

	return { memory: { ...memory, findings }, reopened };
};
