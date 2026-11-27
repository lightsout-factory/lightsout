import { EvidenceSectionState } from '#src/contracts/views/planEvidence/EvidenceSectionState.ts';
import type { PlanEvidence } from '#src/contracts/views/planEvidence/PlanEvidence.ts';
import { measuredCount } from '#src/views/common/measuredCount.ts';
import type { BuildRun } from '#src/views/getPlanEvidence/common/types/BuildRun.ts';

interface Params {
	runs: BuildRun[];
	/** The build run is running, pending or paused. */
	going: boolean;
}

/** Every figure is read from the gate log's exit codes, summed across the family; absent when the family did no gate work. */
export const buildChecksSection = ({ runs, going }: Params): PlanEvidence['checks'] => {
	const sum = ({ figure }: { figure: (run: BuildRun) => number }) => runs.reduce((total, run) => total + figure(run), 0);
	const repairs = new Map<string, number>();

	for (const { summary } of runs) {
		for (const { gateFamily, attempts } of summary.verificationRepairs) {
			repairs.set(gateFamily, (repairs.get(gateFamily) ?? 0) + attempts);
		}
	}

	const gateRuns = sum({ figure: (run) => run.summary.gates.commands });
	const selfChecks = sum({ figure: (run) => run.summary.gates.selfChecks });

	if (gateRuns === 0 && selfChecks === 0 && repairs.size === 0) {
		return undefined;
	}

	return {
		state: going ? EvidenceSectionState.InProgress : EvidenceSectionState.Finished,
		gateRuns: measuredCount({ value: gateRuns }),
		failed: measuredCount({ value: sum({ figure: (run) => run.summary.gates.failed }) }),
		fixed: measuredCount({ value: sum({ figure: (run) => run.summary.gates.fixed }) }),
		selfChecks: measuredCount({ value: selfChecks }),
		repairs: [...repairs.entries()].map(([gateFamily, attempts]) => ({ gateFamily, attempts: measuredCount({ value: attempts }) })),
	};
};
