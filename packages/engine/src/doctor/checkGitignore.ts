import { runCommand } from '#src/common/processes/runCommand.ts';
import { probeTimeoutMs } from '#src/doctor/internal/common/constants/probeTimeoutMs.ts';
import type { DoctorCheck } from '#src/doctor/internal/common/types/DoctorCheck.ts';

interface Params {
	cwd: string;
}

/**
 * Asks git rather than parsing .gitignore: many spellings of the entry are
 * valid, and line-matching cannot recognise them all.
 */
export const checkGitignore = async ({ cwd }: Params): Promise<DoctorCheck> => {
	const stateDir = '.lightsout';
	// A path inside the folder, so `.lightsout/` answers exactly as `.lightsout` does.
	const result = await runCommand({ command: `git check-ignore -q -- '${stateDir}/probe'`, cwd, timeoutMs: probeTimeoutMs }).catch(() => ({ exitCode: 128 }));
	const gitUsable = result.exitCode === 0 || result.exitCode === 1;

	return !gitUsable
		? { id: 'gitignore', status: 'warn', detail: 'not a git repository — .gitignore not evaluated' }
		: result.exitCode === 0
			? { id: 'gitignore', status: 'pass', detail: 'the lightsout state directory is ignored (verified via git check-ignore)' }
			: {
					id: 'gitignore',
					status: 'warn',
					detail: `run state not ignored: ${stateDir}`,
					fix: `add to .gitignore:\n${stateDir}`,
				};
};
