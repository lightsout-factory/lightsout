import type { GateRunResult } from '#src/gates/common/types/GateRunResult.ts';
import { GateEnding } from '#src/gates/internal/common/constants/GateEnding.ts';
import type { GateEntry } from '#src/gates/internal/common/types/GateEntry.ts';
import type { GateOutcome } from '#src/gates/internal/common/types/GateOutcome.ts';
import type { RunGate } from '#src/gates/internal/common/types/RunGate.ts';
import { describeGateCrash } from '#src/gates/internal/common/utils/describeGateCrash.ts';
import { describeGateTimeout } from '#src/gates/internal/common/utils/describeGateTimeout.ts';

interface Params {
	/** Already in order, with every command final. */
	entries: GateEntry[];
	label?: string;
	gate: RunGate;
	/** Default true; false runs every gate and aggregates the failures. */
	failFast?: boolean;
}

/**
 * The order is not this function's to choose: `buildGateStages` decides it,
 * because an override has to be able to replace that decision entirely.
 */
export const runGateSet = async ({ entries, label, gate, failFast = true }: Params): Promise<GateRunResult> => {
	const group = label ?? 'root';
	const prefix = label ? `[${label}] ` : '';
	const failures: string[] = [];
	const failedFamilies: string[] = [];
	const crashes: string[] = [];
	const timeouts: string[] = [];
	const stop = () => failFast && failures.length > 0;

	// A crash or a timeout is not a family a fix agent is asked to repair: it
	// returned no verdict, so nothing is known to be broken. The run still fails
	// closed through `failures`.
	const recordRed = ({ family, name, outcome }: { family: string; name: string; outcome: GateOutcome }) => {
		const label = `${prefix}${name}`;

		failures.push(`${label} failed (exit ${outcome.exitCode}):\n${outcome.stdout}\n${outcome.stderr}`);

		if (outcome.ending === GateEnding.Crashed) {
			crashes.push(describeGateCrash({ label }));
		} else if (outcome.ending === GateEnding.Timeout) {
			timeouts.push(describeGateTimeout({ label, ceilingMinutes: outcome.ceilingMinutes }));
		} else {
			failedFamilies.push(family);
		}
	};

	for (const entry of entries) {
		if (stop()) {
			break;
		}

		const outcome = await gate({ kind: entry.family, command: entry.command, group });

		if (outcome.exitCode !== 0) {
			recordRed({ family: entry.family, name: entry.name, outcome });
		}
	}

	return {
		error: failures.length > 0 ? failures.join('\n\n') : undefined,
		failedFamilies: [...new Set(failedFamilies)],
		crashes,
		timeouts,
		coordination: undefined,
	};
};
