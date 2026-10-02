import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { commitWorkOrderWork } from '#src/commit/commitWorkOrderWork.ts';
import { generatedPaths } from '#tests/helpers/generatedPaths.ts';
import { headSubject } from '#tests/helpers/headSubject.ts';
import { setupTicketBranch } from '#tests/helpers/setupTicketBranch.ts';
import { writeRepoFile } from '#tests/helpers/writeRepoFile.ts';

describe('commitWorkOrderWork', () => {
	test('writes the message through a file, so no ticket title ever needs shell quoting', async () => {
		const { cwd, runDir } = setupTicketBranch();

		writeRepoFile({ cwd, path: 'src.ts', content: 'export const value = 1;\n' });
		await commitWorkOrderWork({ cwd, composeMessage: async () => "LO-70 Don't `break` $(this)", runDir });

		expect(readFileSync(join(runDir, 'commit-message.txt'), 'utf8')).toBe("LO-70 Don't `break` $(this)\n");
		expect(headSubject({ cwd })).toBe("LO-70 Don't `break` $(this)");
	});

	test('asks for the message only after staging, so the composer sees a new file in the staged change', async () => {
		const { cwd, runDir } = setupTicketBranch();
		const staged: string[][] = [];
		const composeMessage = async ({ cwd: composeCwd }: { cwd: string }) => {
			staged.push(execSync('git diff --cached --name-only', { cwd: composeCwd }).toString().split('\n').filter(Boolean));

			return 'LO-167: add the widget\n\nlightsout run run-1\n';
		};

		writeRepoFile({ cwd, path: 'widget.ts', content: 'export const widget = 1;\n' });

		await commitWorkOrderWork({ cwd, composeMessage, runDir });

		expect(staged).toStrictEqual([['widget.ts']]);
		expect(headSubject({ cwd })).toBe('LO-167: add the widget');
	});

	test('answers the message it committed under', async () => {
		const { cwd, runDir } = setupTicketBranch();
		const message = 'LO-167: add the widget\n\nThe widget stands alone.\n\nlightsout run run-1\n';

		writeRepoFile({ cwd, path: 'widget.ts', content: 'export const widget = 1;\n' });

		const committed = await commitWorkOrderWork({ cwd, composeMessage: async () => message, runDir });

		expect(committed).toStrictEqual({ committed: true, message: 'LO-167: add the widget\n\nThe widget stands alone.\n\nlightsout run run-1\n' });
	});

	test('never asks for a message when there is no source change to commit or the change cannot be staged', async () => {
		const clean = setupTicketBranch();
		const generatedOnly = setupTicketBranch();
		const unstageable = setupTicketBranch();
		const asked: string[] = [];
		const composeMessage = async ({ cwd }: { cwd: string }) => {
			asked.push(cwd);

			return 'LO-167: never used';
		};

		writeRepoFile({ cwd: generatedOnly.cwd, path: 'plugin/dist/chunk.mjs', content: '// built on the branch\n' });
		writeRepoFile({ cwd: unstageable.cwd, path: 'src.ts', content: 'export const value = 1;\n' });
		// An index git will not let go of makes staging fail while the tree still
		// reads as changed.
		writeFileSync(join(unstageable.cwd, '.git', 'index.lock'), '');

		const results = [
			await commitWorkOrderWork({ ...clean, composeMessage }),
			await commitWorkOrderWork({ ...generatedOnly, composeMessage, generated: generatedPaths }),
			await commitWorkOrderWork({ ...unstageable, composeMessage }),
		];

		expect(results).toEqual([
			{ committed: false },
			{ committed: false },
			{ error: expect.stringContaining(`git could not stage the work in ${unstageable.cwd}`) },
		]);
		expect(asked).toStrictEqual([]);
	});
});
