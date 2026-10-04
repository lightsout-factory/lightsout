import { runCommand } from '#src/common/processes/runCommand.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { probeTimeoutMs } from '#src/doctor/internal/common/constants/probeTimeoutMs.ts';
import type { DoctorCheck } from '#src/doctor/internal/common/types/DoctorCheck.ts';

interface Params {
	cwd: string;
	config: LightsoutConfig;
}

export const checkScriptBinaries = async ({ cwd, config }: Params): Promise<DoctorCheck> => {
	const gateCommands = [...Object.values(config.gates), ...Object.values(config['package-gates'] ?? {})].filter(
		(value): value is string => typeof value === 'string',
	);
	const binaries = [...new Set(gateCommands.map((command) => command.trim().split(/\s+/)[0]).filter((name): name is string => Boolean(name)))];
	const missingBinaries: string[] = [];

	for (const name of binaries) {
		const result = await runCommand({ command: `command -v ${name}`, cwd, timeoutMs: probeTimeoutMs }).catch(() => ({ exitCode: -1 }));

		if (result.exitCode !== 0) {
			missingBinaries.push(name);
		}
	}

	return missingBinaries.length === 0
		? { id: 'script-binaries', status: 'pass', detail: `gate commands resolve (${binaries.join(', ')})` }
		: {
				id: 'script-binaries',
				status: 'fail',
				detail: `not on PATH: ${missingBinaries.join(', ')}`,
				fix: 'install the missing tool(s) — every gate depends on them',
			};
};
