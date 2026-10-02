import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import type { DoctorCheck } from '#src/doctor/internal/common/types/DoctorCheck.ts';

interface Params {
	config: LightsoutConfig;
}

/**
 * A note rather than a warning: standards are opt-in, so running without them
 * is a legitimate choice — but an unset key is also what a repo that meant to
 * have them looks like. `standards-pack: false` says the choice out loud, and
 * a package named in `package-standards-packs` has standards, so both are silent.
 */
export const checkStandardsPack = ({ config }: Params): DoctorCheck | undefined => {
	const namesPackagePack = Object.keys(config['package-standards-packs'] ?? {}).length > 0;

	if (config['standards-pack'] !== undefined || namesPackagePack) {
		return undefined;
	}

	return {
		id: 'standards-pack',
		status: 'note',
		detail:
			'no `standards-pack` is set, so runs use no code standards: agents get no rules and no standards checks run. Set `"standards-pack"` to a pack address, `"<library>/<pack>"`, to turn standards on, or to `false` to record that none are wanted.',
	};
};
