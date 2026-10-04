import { runGh } from '#src/ship/forge/common/runGh.ts';

interface Params {
	cwd: string;
}

/**
 * One boolean rather than a reason: `gh` not installed and `gh` logged out
 * need the same fix from the same person.
 */
export const readForgeAuth = async ({ cwd }: Params): Promise<boolean> => {
	const status = await runGh({ args: ['auth', 'status'], cwd });

	return status.exitCode === 0;
};
