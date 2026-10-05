import { PlanRunStatus } from '#src/common/constants/PlanRunStatus.ts';
import { getBlockingFindings } from '#src/common/findings/getBlockingFindings.ts';
import type { AgentOutcome } from '#src/common/types/AgentOutcome.ts';
import type { PlanFixReport } from '#src/contracts/plan/draft/PlanFixReport.ts';
import { PlanFixStatus } from '#src/contracts/plan/draft/PlanFixStatus.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';
import { getFindingSetKey } from '#src/plan/draft/focused/common/convergeFindings/getFindingSetKey.ts';
import { maxPlanRepairAttempts } from '#src/plan/draft/focused/common/convergeFindings/maxPlanRepairAttempts.ts';
import type { PlanRepairResult } from '#src/plan/draft/focused/common/types/PlanRepairResult.ts';

interface Params {
	/** Kebab plan name — narrated in progress lines and in the parked re-run command. */
	name: string;
	/** What this loop calls one round, in progress lines: `repair`, `reshape`. */
	verb: string;
	/** What this loop calls what it is converging, in progress lines: `structural finding(s)`. */
	findingNoun: string;
	/** Re-read what is on disk and report it. `undefined` means the files could not be read at all. */
	check: () => Promise<StructuralFinding[] | undefined>;
	/** The failure a `check` returning `undefined` ends the loop with. */
	unreadableError: string;
	/** Spawn one correcting agent against the blocking findings; it edits the files in place. */
	runAttempt: (params: { findings: StructuralFinding[]; attempt: number }) => Promise<AgentOutcome<PlanFixReport>>;
	progress: (message: string) => void;
}

/**
 * Only blocking findings drive the loop and reach the agent: an advisory is not
 * a defect and must never consume a repair attempt.
 */
export const convergeFindings = async ({ name, verb, findingNoun, check, unreadableError, runAttempt, progress }: Params): Promise<PlanRepairResult> => {
	const unreadable = { status: PlanRunStatus.Failed, error: unreadableError } as const;

	let findings = await check();

	if (findings === undefined) {
		return unreadable;
	}

	for (let attempt = 1; attempt <= maxPlanRepairAttempts && getBlockingFindings({ findings }).length > 0; attempt += 1) {
		const blocking = getBlockingFindings({ findings });

		progress(`plan draft ${name}: ${blocking.length} ${findingNoun} — ${verb} ${attempt}/${maxPlanRepairAttempts}`);

		const beforeKey = getFindingSetKey({ findings });
		const outcome = await runAttempt({ findings: blocking, attempt });

		if (!outcome.ok) {
			return outcome.rateLimited
				? { status: PlanRunStatus.PausedRateLimit, error: `rate limited or overloaded — re-run: lightsout plan draft --name ${name}` }
				: { status: PlanRunStatus.Failed, error: outcome.failure };
		}

		// A declining agent may have fixed other findings first, so the surviving
		// set must come from the re-check below, never from the pre-attempt list.
		const declined = outcome.report.status === PlanFixStatus.Error;

		if (declined) {
			for (const discrepancy of outcome.report.discrepancies) {
				progress(`plan draft ${name}: ${verb} declined — ${discrepancy}`);
			}
		}

		// A file the agent deleted or broke re-surfaces here — the check reports
		// an unreadable plan file rather than passing it over.
		findings = await check();

		if (findings === undefined) {
			return unreadable;
		}

		if (declined) {
			break;
		}

		// Every round gets identical inputs, so a finding set that came back
		// unchanged predicts an unchanged retry.
		if (getBlockingFindings({ findings }).length > 0 && getFindingSetKey({ findings }) === beforeKey) {
			progress(`plan draft ${name}: ${verb} ${attempt} made no progress — stopping`);

			break;
		}
	}

	return { status: PlanRunStatus.Complete, findings };
};
