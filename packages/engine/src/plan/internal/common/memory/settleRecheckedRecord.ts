import { GapOutcome } from '#src/contracts/plan/grade/GapOutcome.ts';
import type { GapVerdict } from '#src/contracts/plan/grade/GapVerdict.ts';
import type { GradeFindingRecord } from '#src/contracts/plan/memory/GradeFindingRecord.ts';
import { GradeFindingStatus } from '#src/contracts/plan/memory/GradeFindingStatus.ts';
import type { AgentOutcome } from '#src/invoke/common/types/AgentOutcome.ts';
import { confirmCitation } from '#src/plan/internal/common/memory/confirmCitation.ts';

interface Params {
	cwd: string;
	record: GradeFindingRecord;
	/** One entry per location of the record; `outcome` is `undefined` when the judge never answered. */
	located: Array<{ location: string; planText: string; outcome: AgentOutcome<GapVerdict> | undefined }>;
	at: string;
}

const checkLocation = async ({
	cwd,
	location,
	planText,
	outcome,
}: {
	cwd: string;
	location: string;
	planText: string;
	outcome: AgentOutcome<GapVerdict> | undefined;
}) => {
	const report = outcome?.ok === true ? outcome.report : undefined;
	const citation = report?.outcome === GapOutcome.AlreadyAnswered ? (report.answerAt ?? '') : undefined;
	const confirmed = citation === undefined ? undefined : await confirmCitation({ cwd, citation, planText });

	return {
		resolution: confirmed?.ok === true && citation !== undefined ? { phase: location, answerAt: citation } : undefined,
		refusal: confirmed?.ok === false ? `${location}: ${confirmed.reason}` : undefined,
	};
};

/** Closes only when EVERY location returned a citation confirmed against that location's own text: fixing one occurrence never closes the others. */
export const settleRecheckedRecord = async ({ cwd, record, located, at }: Params): Promise<{ record: GradeFindingRecord; refusal: string | undefined }> => {
	const checks = await Promise.all(located.map(({ location, planText, outcome }) => checkLocation({ cwd, location, planText, outcome })));
	const resolutions = checks.flatMap(({ resolution }) => (resolution === undefined ? [] : [{ ...resolution, verifiedAt: at }]));
	const refusals = checks.flatMap(({ refusal }) => (refusal === undefined ? [] : [refusal]));
	const closed = resolutions.length === located.length;

	// Stamped whatever the answer was: the stamp says the question was ASKED,
	// which stops the next pass buying it again.
	const asked = { ...record, lastRecheckedAt: at };

	return {
		record: closed ? { ...asked, status: GradeFindingStatus.Resolved, resolutions } : asked,
		refusal: refusals.length > 0 ? refusals.join('; ') : undefined,
	};
};
