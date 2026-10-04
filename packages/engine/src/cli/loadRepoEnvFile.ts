import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { readGitPrimaryCheckout } from '#src/common/git/readGitPrimaryCheckout.ts';
import { messageOf } from '#src/common/messageOf.ts';

interface Params {
	/** The directory the command runs in — the repository root, or a linked worktree of it. */
	cwd: string;
}

/**
 * Falls back to the primary checkout's `.env`: it is gitignored, so a linked
 * worktree never has the user's copy. The nearest file wins and only one is read.
 */
const resolveEnvFilePath = async ({ cwd }: Params): Promise<string | undefined> => {
	const own = join(cwd, '.env');

	if (existsSync(own)) {
		return own;
	}

	const primary = await readGitPrimaryCheckout({ cwd });
	const shared = primary === undefined ? undefined : join(primary, '.env');

	return shared !== undefined && shared !== own && existsSync(shared) ? shared : undefined;
};

/**
 * Not `process.loadEnvFile`: it writes the real environment block, which a test
 * in a worker cannot observe, so "the environment wins over the file" could not
 * be tested. A variable already set keeps its value.
 *
 * An unreadable file is reported and the command carries on: failing would turn
 * a stray quote into an outage, and silence would hide why a key is missing.
 */
export const loadRepoEnvFile = async ({ cwd }: Params): Promise<void> => {
	const envFilePath = await resolveEnvFilePath({ cwd });

	if (envFilePath === undefined) {
		return;
	}

	try {
		for (const [name, value] of Object.entries(parseEnv(readFileSync(envFilePath, 'utf8')))) {
			process.env[name] ??= value;
		}
	} catch (error) {
		console.error(`lightsout: ignored ${envFilePath}: ${messageOf({ error })}`);
	}
};
