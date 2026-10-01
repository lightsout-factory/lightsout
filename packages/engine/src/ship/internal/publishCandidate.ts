import { quoteShellArgument } from '#src/common/processes/quoteShellArgument.ts';
import type { ShipStepFailure } from '#src/ship/common/types/ShipStepFailure.ts';
import { runGit } from '#src/ship/internal/common/utils/runGit.ts';
import { pushBranch } from '#src/ship/internal/pushBranch.ts';

interface Params {
	branch: string;
	cwd: string;
	/** The exact commit this attempt verified — the only thing that counts as published. */
	candidate: string;
}

const readRemoteTip = async ({ branch, cwd }: { branch: string; cwd: string }) => {
	const remoteReadTimeoutMs = 60_000;
	const listed = await runGit({ command: `git ls-remote --heads origin ${quoteShellArgument({ argument: branch })}`, cwd, timeoutMs: remoteReadTimeoutMs });

	return listed?.exitCode === 0 ? listed.stdout.trim().split('\t')[0] : undefined;
};

/**
 * A push whose command failed may still have published (a connection dropped after the pack was
 * accepted), so the remote's own ref answers. Only an exact match with the candidate counts;
 * nothing force-pushes or retries an ambiguous outcome.
 */
export const publishCandidate = async ({ branch, cwd, candidate }: Params): Promise<ShipStepFailure | undefined> => {
	const failure = await pushBranch({ branch, cwd });

	if (failure === undefined) {
		return undefined;
	}

	return (await readRemoteTip({ branch, cwd })) === candidate ? undefined : failure;
};
