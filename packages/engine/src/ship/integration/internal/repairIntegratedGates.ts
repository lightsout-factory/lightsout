import { jestCrashCause } from '#src/common/constants/jestCrashCause.ts';
import { maxCheapFixRetries } from '#src/common/constants/maxCheapFixRetries.ts';
import { ShipBlockReason } from '#src/contracts/ship/ShipBlockReason.ts';
import type { GateRunResult } from '#src/gates/common/types/GateRunResult.ts';
import { runGates } from '#src/gates/runGates.ts';
import type { ShipIntegration } from '#src/ship/common/types/ShipIntegration.ts';
import type { IntegrationFailure } from '#src/ship/integration/common/types/IntegrationFailure.ts';
import { invokeShipIntegrator } from '#src/ship/integration/internal/invokeShipIntegrator.ts';
import { appendCommandOutput } from '#src/ship/internal/common/utils/appendCommandOutput.ts';
import { runPreShip } from '#src/ship/internal/runPreShip.ts';

interface Params {
	cwd: string;
	integration: ShipIntegration;
	branch: string;
	defaultBranch: string;
	standards?: string;
	/** The configured release command, or undefined when the repository has no such convention. */
	preShip: string | undefined;
	/** The exact commit the default branch was pinned to, which preparation measures its version against. */
	baseCommit: string;
	onProgress?: (message: string) => void;
}

const verifyCandidate = async ({
	cwd,
	integration,
	preShip,
	baseCommit,
	onProgress,
}: Omit<Params, 'branch' | 'defaultBranch' | 'standards'>): Promise<{ blocked: IntegrationFailure } | { gates: GateRunResult }> => {
	const hookFailure = preShip === undefined ? undefined : await runPreShip({ cwd, command: preShip, baseCommit, onProgress });

	if (hookFailure !== undefined) {
		return {
			blocked: {
				reason: ShipBlockReason.PreShipFailed,
				detail: appendCommandOutput({ sentence: `the pre-ship command '${preShip}' failed`, stderr: hookFailure.stderr }),
				paths: [],
			},
		};
	}

	const gates = await runGates({ cwd, config: integration.config, coverage: true, includeRoot: true, onProgress });

	// No verdict about the code (no run, a crash, a timeout): block, never repair.
	if (gates.coordination !== undefined) {
		return {
			blocked: {
				reason: ShipBlockReason.IntegrationGatesUnavailable,
				detail: gates.coordination,
				paths: [],
			},
		};
	}

	if (gates.crashes.length > 0) {
		return {
			blocked: {
				reason: ShipBlockReason.IntegrationGatesCrashed,
				detail: [
					'a gate crashed instead of failing — not a verdict about the code.',
					jestCrashCause,
					'No repair was attempted and no repair attempt was spent.',
					gates.crashes.join('\n'),
					gates.error ?? '',
				].join('\n\n'),
				paths: [],
			},
		};
	}

	if (gates.timeouts.length > 0) {
		return {
			blocked: {
				reason: ShipBlockReason.IntegrationGatesTimedOut,
				detail: [
					'a gate ran past its own time ceiling (timeouts.gate-minutes) — not a verdict about the code.',
					'No repair was attempted and no repair attempt was spent.',
					gates.timeouts.join('\n'),
					gates.error ?? '',
				].join('\n\n'),
				paths: [],
			},
		};
	}

	return { gates };
};

/**
 * Preparation runs before every verification, so each is measured against the
 * same base.
 *
 * @returns undefined once the gates are green, else why the allowance ran out — with the last repair attempt's own refusal when it gave one — and which families stayed red
 */
export const repairIntegratedGates = async ({
	cwd,
	integration,
	branch,
	defaultBranch,
	standards,
	preShip,
	baseCommit,
	onProgress,
}: Params): Promise<IntegrationFailure | undefined> => {
	let refusal: string | undefined;

	for (let attempt = 0; ; attempt += 1) {
		const verified = await verifyCandidate({ cwd, integration, preShip, baseCommit, onProgress });

		if ('blocked' in verified) {
			return verified.blocked;
		}

		const { error, failedFamilies } = verified.gates;

		if (error === undefined) {
			return undefined;
		}

		if (attempt === maxCheapFixRetries) {
			const detail = refusal === undefined ? error : `${error}\n\nThe last repair attempt reported: ${refusal}`;

			return { reason: ShipBlockReason.IntegrationGatesFailed, detail, paths: failedFamilies };
		}

		onProgress?.(`integrate: the gates are red — re-invoking the integrator with their output (fix ${attempt + 1} of ${maxCheapFixRetries})`);
		refusal = await invokeShipIntegrator({ cwd, integration, branch, defaultBranch, standards, errorContext: error });
	}
};
