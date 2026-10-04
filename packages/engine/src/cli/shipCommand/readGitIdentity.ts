import { gitTimeoutMs } from '#src/common/constants/gitTimeoutMs.ts';
import { runCommand } from '#src/common/processes/runCommand.ts';
import type { GitIdentity } from '#src/common/types/GitIdentity.ts';

interface Params {
	cwd: string;
}

const readGitConfigValue = async ({ cwd, key }: { cwd: string; key: string }) => {
	const read = await runCommand({ command: `git config ${key}`, cwd, timeoutMs: gitTimeoutMs }).catch(() => undefined);
	const value = read && read.exitCode === 0 ? read.stdout.trim() : '';

	return value === '' ? undefined : value;
};

/**
 * Read from the effective config in `cwd`, so a repository's own identity wins over a global one.
 * A key set to the empty string is left absent like an unset one: git itself refuses to commit
 * under an empty ident, so an empty value is no identity.
 */
export const readGitIdentity = async ({ cwd }: Params): Promise<GitIdentity> => {
	const name = await readGitConfigValue({ cwd, key: 'user.name' });
	const email = await readGitConfigValue({ cwd, key: 'user.email' });

	return { ...(name === undefined ? {} : { name }), ...(email === undefined ? {} : { email }) };
};
