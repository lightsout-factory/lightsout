import { execFileSync } from 'node:child_process';
import { describe, expect, test } from '@jest/globals';
import { readGitIdentity } from '#src/common/git/readGitIdentity.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';

const setupIdentityRepo = ({ name, email }: { name: string; email: string }) => {
	const cwd = setupConsumerRepo();

	// the repository's own config, which wins over any global identity on the machine
	execFileSync('git', ['config', 'user.name', name], { cwd });
	execFileSync('git', ['config', 'user.email', email], { cwd });

	return { cwd };
};

describe('readGitIdentity', () => {
	test("answers the user.name and user.email a repository's own config sets", async () => {
		const { cwd } = setupIdentityRepo({ name: 'Ada Lovelace', email: 'ada@example.com' });

		const identity = await readGitIdentity({ cwd });

		expect(identity).toStrictEqual({ name: 'Ada Lovelace', email: 'ada@example.com' });
	});

	test('answers a key the repository sets to the empty string as unset and keeps the other', async () => {
		const { cwd } = setupIdentityRepo({ name: '', email: 'ada@example.com' });

		const identity = await readGitIdentity({ cwd });

		// git refuses to commit under an empty ident, so an empty name is no name at all
		expect({ name: identity.name, email: identity.email }).toStrictEqual({ name: undefined, email: 'ada@example.com' });
	});
});
