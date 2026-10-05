import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, jest, test } from '@jest/globals';
import type { CommandResult } from '#src/common/types/CommandResult.ts';
import { readGitHeadBlobIds } from '#src/pipeline/moveCheck/checkMoveOnlyChanges/readGitHeadBlobIds.ts';
import { readGitWorkingBlobIds } from '#src/pipeline/moveCheck/checkMoveOnlyChanges/readGitWorkingBlobIds.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';

// Mocked Imports
// -------------------------
// The spawner is doubled only to count spawns: every call reaches straight
// through it to real git, because the ids under test are git's own.
interface RunCommandParams {
	command: string;
	cwd: string;
	timeoutMs?: number;
	env?: Record<string, string>;
	onSpawn?: ({ pid }: { pid: number }) => void;
	onTimeout?: () => void;
}

const actual = jest.requireActual<typeof import('#src/common/processes/runCommand.ts')>('#src/common/processes/runCommand.ts');
const mockRunCommand = jest.fn<(params: RunCommandParams) => Promise<CommandResult> | undefined>();

jest.mock('#src/common/processes/runCommand.ts', () => ({
	runCommand: (params: RunCommandParams) => mockRunCommand(params) ?? actual.runCommand(params),
}));
// -------------------------

/** The blob id git stores for the bytes `hello\n`. */
const helloBlobId = 'ce013625030ba8dba906f756967f9e9ca394464a';
/** The blob id git stores for an empty file. */
const emptyBlobId = 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391';

/**
 * A committed repo holding `src/source.txt` (`hello\n`), an empty
 * `src/edited.txt`, and `bulkCount` files of distinct content under `bulk/`.
 * After the commit, `src/source.txt` is copied unchanged to `src/copy.txt` and
 * `src/edited.txt` is rewritten to `hello\n`. `emptyCwd` is a directory that
 * does not exist, so any spawn there would fail rather than answer.
 */
const setupBlobRepo = ({ bulkCount = 450 }: { bulkCount?: number } = {}) => {
	const bulkPaths = Array.from({ length: bulkCount }, (_, index) => `bulk/file${index}.txt`);
	const cwd = setupConsumerRepo({
		sources: {
			'src/source.txt': 'hello\n',
			'src/edited.txt': '',
			...Object.fromEntries(bulkPaths.map((path, index) => [path, `console.log(${index});\n`])),
		},
	});

	writeFileSync(join(cwd, 'src', 'copy.txt'), 'hello\n');
	writeFileSync(join(cwd, 'src', 'edited.txt'), 'hello\n');

	return { cwd, bulkPaths, emptyCwd: '/lightsout/no/such/directory' };
};

test('readGitWorkingBlobIds: hashes working files to the ids git would store, in chunks', async () => {
	const { cwd, bulkPaths, emptyCwd } = setupBlobRepo();

	const [head, working, bulk, empty] = await Promise.all([
		readGitHeadBlobIds({ cwd }),
		readGitWorkingBlobIds({ cwd, paths: ['src/copy.txt', 'src/edited.txt'] }),
		readGitWorkingBlobIds({ cwd, paths: bulkPaths }),
		readGitWorkingBlobIds({ cwd: emptyCwd, paths: [] }),
	]);

	// the copy hashes to its committed source's id while the edit moves off
	// its own; 450 paths are answered in full, each matching HEAD, across
	// three chunked spawns; an empty list never spawns at all
	expect({
		sourceHeadId: head?.get('src/source.txt'),
		editedHeadId: head?.get('src/edited.txt'),
		working,
		bulk,
		bulkHashSpawns: mockRunCommand.mock.calls.filter(([params]) => params.command.includes('hash-object') && params.command.includes('bulk/')).length,
		empty,
		emptySpawns: mockRunCommand.mock.calls.filter(([params]) => params.cwd === emptyCwd).length,
	}).toStrictEqual({
		sourceHeadId: helloBlobId,
		editedHeadId: emptyBlobId,
		working: new Map([
			['src/copy.txt', helloBlobId],
			['src/edited.txt', helloBlobId],
		]),
		bulk: new Map(bulkPaths.map((path) => [path, head?.get(path)])),
		bulkHashSpawns: 3,
		empty: new Map(),
		emptySpawns: 0,
	});
});

test.each([
	{ where: 'a path missing from disk in the second chunk', inRepo: true },
	{ where: 'a working directory that does not exist', inRepo: false },
])('readGitWorkingBlobIds: answers undefined when any chunk cannot be hashed, as for $where', async ({ inRepo }) => {
	const { cwd, bulkPaths, emptyCwd } = setupBlobRepo({ bulkCount: 200 });

	const blobIds = await readGitWorkingBlobIds({ cwd: inRepo ? cwd : emptyCwd, paths: [...bulkPaths, 'src/missing.txt'] });

	// a chunk that answered is not handed back alone: a partial map would leave
	// every file it lacks looking changed rather than unread
	expect(blobIds).toBe(undefined);
});
