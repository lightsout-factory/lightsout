import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import type { DoctorCheck } from '#src/doctor/internal/common/types/DoctorCheck.ts';

interface Params {
	config: LightsoutConfig;
}

/**
 * Advice rather than a failure: some repos list `generated` only to keep
 * folders out of the standards checks, and have nothing for a phase to rebuild.
 */
export const checkGenerateCommand = ({ config }: Params): DoctorCheck | undefined => {
	const generated = config.generated ?? [];

	if (generated.length === 0 || config.gates.generate !== undefined) {
		return undefined;
	}

	return {
		id: 'generate-command',
		status: 'warn',
		detail: `\`generated\` lists ${generated.length} path(s) but no \`gates.generate\` command is set. A phased plan carries build output from one phase to the next only as current as the last gate that rebuilt it, and every other check reads what is on disk.`,
		fix: 'set `gates.generate` to the command that rebuilds those paths, so every set of gates starts from current output.',
	};
};
