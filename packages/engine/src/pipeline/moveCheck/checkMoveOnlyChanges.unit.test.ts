import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import type { PipelineRun } from '#src/pipeline/internal/PipelineRun.ts';
import { checkMoveOnlyChanges } from '#src/pipeline/moveCheck/checkMoveOnlyChanges.ts';
import { commitAll } from '#tests/helpers/commitAll.ts';
import { generatedPaths } from '#tests/helpers/generatedPaths.ts';
import { runInRepo } from '#tests/helpers/runInRepo.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';
import { writeRepoFile } from '#tests/helpers/writeRepoFile.ts';

type CountTokens = (params: { text: string }) => Map<string, number>;

// Mocked Imports
// -------------------------
const mockCountTokens = jest.fn<CountTokens>();
const { countTokens } = jest.requireActual<{ countTokens: CountTokens }>('#src/pipeline/internal/common/tokens/countTokens.ts');

jest.mock('#src/pipeline/internal/common/tokens/countTokens.ts', () => ({ countTokens: (params: { text: string }) => mockCountTokens(params) }));
// -------------------------

type Content = string | Buffer;

interface Move {
	from: string;
	to: string;
}

interface Edits {
	/** Written after the phase start and before any move, so git never tracked them. */
	untracked?: Record<string, string>;
	/** Moved on disk byte for byte, a file or a whole folder, and left unstaged. */
	rename?: Record<string, string>;
	remove?: string[];
	write?: Record<string, Content>;
	/** Staged and then deleted within the run, which git reports as `AD`. */
	createdAndDeleted?: string[];
}

const widgetsMove: Move = { from: 'app/widgets', to: 'app/ui/widgets' };
const assetsMove: Move = { from: 'assets', to: 'media' };
const binaryBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0xff, 0xfe, 0x00, 0x80, 0x41]);

const plant = ({ cwd, files }: { cwd: string; files: Record<string, Content> }) => {
	for (const [path, content] of Object.entries(files)) {
		mkdirSync(dirname(join(cwd, path)), { recursive: true });
		writeFileSync(join(cwd, path), content);
	}
};

/**
 * A PipelineRun stub over a real git repo. `committed` is what `HEAD` carries at
 * the phase start, beside the repo's own `src/index.js` and `src/useIndex.js`;
 * `edits` is what the implement agent left in the working tree. Every text the
 * check tokenizes passes through the real `countTokens`.
 */
const setupMoveCheck = ({
	git = true,
	committed = {},
	edits = {},
	baselineDirtyFiles = [],
	generated,
	unbornHead = false,
}: {
	git?: boolean;
	committed?: Record<string, Content>;
	edits?: Edits;
	baselineDirtyFiles?: string[];
	generated?: string[];
	/** Leaves the committed files staged on a branch with no commit, so git reports changes but `HEAD` names nothing. */
	unbornHead?: boolean;
} = {}) => {
	mockCountTokens.mockImplementation(countTokens);
	const cwd = setupConsumerRepo({ git });

	plant({ cwd, files: committed });

	if (git && Object.keys(committed).length > 0) {
		commitAll({ cwd, message: 'the phase start' });
	}

	if (unbornHead) {
		runInRepo({ cwd, command: 'git', args: ['checkout', '-q', '--orphan', 'unborn'] });
	}

	plant({ cwd, files: edits.untracked ?? {} });

	for (const [from, to] of Object.entries(edits.rename ?? {})) {
		mkdirSync(dirname(join(cwd, to)), { recursive: true });
		renameSync(join(cwd, from), join(cwd, to));
	}

	for (const path of edits.remove ?? []) {
		rmSync(join(cwd, path));
	}

	plant({ cwd, files: edits.write ?? {} });

	for (const path of edits.createdAndDeleted ?? []) {
		writeRepoFile({ cwd, path, content: 'export const transient = 1;\n' });
		runInRepo({ cwd, command: 'git', args: ['add', path] });
		rmSync(join(cwd, path));
	}

	const progressLines: string[] = [];
	const manifest = { runId: 'run-1', changedFiles: [], packages: [], baselineDirtyFiles } as unknown as RunManifest;
	const run = {
		cwd,
		config: { gates: { check: 'true', test: 'true' }, ...(generated ? { generated } : {}) } as unknown as LightsoutConfig,
		current: () => manifest,
		progress: (message: string) => progressLines.push(message),
	} as unknown as PipelineRun;

	return { run, progressLines };
};

const refusalLines = ({ result }: { result: { error?: string } }) => (result.error ?? '').split('\n');

/** Whether the check passed, and for each group of paths whether one refusal line names them all. */
const judge = ({ result, named }: { result: { error?: string }; named: string[][] }) => ({
	passes: Object.keys(result).length === 0,
	named: named.map((parts) => refusalLines({ result }).some((line) => parts.every((part) => line.includes(part)))),
});

const refusalLine = ({ result, path }: { result: { error?: string }; path: string }) => refusalLines({ result }).find((line) => line.includes(path)) ?? '';

const tokenizedTexts = ({ marker }: { marker: string }) => mockCountTokens.mock.calls.filter(([{ text }]) => text.includes(marker)).length;

describe('checkMoveOnlyChanges', () => {
	test.each([
		{ leftUnadded: [], passes: true, named: [] },
		{ leftUnadded: ['app/ui/widgets/card.ts'], passes: false, named: [['app/widgets/card.ts']] },
	])(
		'checkMoveOnlyChanges: a folder moved with its relative imports re-deepened and its importers re-pointed passes',
		async ({ leftUnadded, passes, named }) => {
			const { run } = setupMoveCheck({
				committed: { 'app/widgets/button.ts': "import '../theme.ts';\n", 'app/widgets/card.ts': 'card\n', 'app/main.ts': "import './widgets/card.ts';\n" },
				edits: {
					rename: { 'app/widgets': 'app/ui/widgets' },
					remove: leftUnadded,
					write: { 'app/ui/widgets/button.ts': "import '../../theme.ts';\n", 'app/main.ts': "import './ui/widgets/card.ts';\n" },
				},
			});

			const result = await checkMoveOnlyChanges({ run, checkpoint: 'verify-implement', fileMoves: [], folderMoves: [widgetsMove] });

			expect(judge({ result, named })).toStrictEqual({ passes, named: named.map(() => true) });
		},
	);

	test.each([
		{ edit: { from: 'export const size', to: '// export const size' } },
		{ edit: { from: '= 1;', to: '= -1;' } },
		{ edit: { from: '[base]', to: '[...base]' } },
		{ edit: { from: '[app, theme]', to: '[theme]' } },
	])('checkMoveOnlyChanges: punctuation and path words changed outside a path are refused', async ({ edit }) => {
		const body = 'export const size = 1;\nexport const list = [base];\nexport const pair = [app, theme];\n';
		const edited = body.replace(edit.from, edit.to);
		const { run } = setupMoveCheck({
			committed: { 'app/widgets/button.ts': `import '../theme.ts';\n${body}`, 'app/main.ts': `import './widgets/button.ts';\n${body}` },
			edits: {
				remove: ['app/widgets/button.ts'],
				write: { 'app/ui/widgets/button.ts': `import '../../theme.ts';\n${edited}`, 'app/main.ts': `import './ui/widgets/button.ts';\n${edited}` },
			},
		});
		const named = [['app/ui/widgets/button.ts'], ['app/main.ts']];

		const result = await checkMoveOnlyChanges({ run, checkpoint: 'verify-implement', fileMoves: [], folderMoves: [widgetsMove] });

		// every token each edit touches is `/`, `.`, `-` or the move-path word `app`,
		// but none of them sits inside a path, so the text outside paths changed
		expect(judge({ result, named })).toStrictEqual({ passes: false, named: [true, true] });
	});

	test('checkMoveOnlyChanges: a bare declared move path and a slashed path to a moved file may both be updated', async () => {
		const { run } = setupMoveCheck({
			committed: { 'build.json': '{\n\t"rootDir": "src",\n\t"main": "src/index.ts"\n}\n' },
			edits: { rename: { src: 'lib' }, write: { 'build.json': '{\n\t"rootDir": "lib",\n\t"main": "lib/index.ts"\n}\n' } },
		});

		const result = await checkMoveOnlyChanges({ run, checkpoint: 'verify-implement', fileMoves: [], folderMoves: [{ from: 'src', to: 'lib' }] });

		expect(result).toStrictEqual({});
	});

	test('checkMoveOnlyChanges: a file moved with identical content passes by blob id without being tokenized', async () => {
		const { run } = setupMoveCheck({
			committed: { 'assets/logo.bin': binaryBytes, 'assets/badge.bin': binaryBytes, 'assets/big.txt': 'untouchedLine 0123456789\n'.repeat(8200) },
			edits: { rename: { assets: 'media' }, write: { 'media/badge.bin': Buffer.from([...binaryBytes.subarray(0, -1), 0x42]) } },
		});

		const result = await checkMoveOnlyChanges({ run, checkpoint: 'verify-implement', fileMoves: [], folderMoves: [assetsMove] });

		// only the copy of the binary with one byte changed is refused; the rest pass on their blob ids
		expect({
			refusesChangedBinary: refusalLine({ result, path: 'badge.bin' }) !== '',
			namesUnchanged: ['logo.bin', 'big.txt'].filter((path) => refusalLine({ result, path }) !== ''),
			tokenized: tokenizedTexts({ marker: 'untouchedLine' }) + tokenizedTexts({ marker: '\uFFFD' }),
		}).toStrictEqual({ refusesChangedBinary: true, namesUnchanged: [], tokenized: 0 });
	});

	test('checkMoveOnlyChanges: a changed file that is not valid UTF-8 text on either side is refused without being tokenized', async () => {
		const { run } = setupMoveCheck({
			committed: { 'assets/logo.bin': Buffer.from([0x41, 0xff, 0x42]), 'assets/notes.txt': 'plain text\n' },
			edits: {
				remove: ['assets/logo.bin', 'assets/notes.txt'],
				write: { 'media/logo.bin': Buffer.from([0x41, 0xfe, 0x42]), 'media/notes.txt': Buffer.from([...Buffer.from('plain text'), 0xff, 0x0a]) },
			},
		});

		const result = await checkMoveOnlyChanges({ run, checkpoint: 'verify-implement', fileMoves: [], folderMoves: [assetsMove] });

		// both sides of the binary decode to the same text, so the refusal names no token
		const lines = ['logo.bin', 'notes.txt'].map((path) => refusalLine({ result, path }));

		expect({
			refusedAsNonText: lines.map((line) => /unchanged/i.test(line) && !line.includes('×')),
			tokenized: tokenizedTexts({ marker: '\uFFFD' }),
		}).toStrictEqual({ refusedAsNonText: [true, true], tokenized: 0 });
	});

	test.each([
		{
			edits: { rename: { 'old/one.ts': 'new/one.ts', 'old/two.ts': 'new/two.ts' }, write: { 'lib/beta.ts': 'beta edited\n' } },
			leftBehind: ['lib/alpha.ts', 'lib/beta.ts', 'old/three.ts'],
		},
		{ edits: {}, leftBehind: ['lib/alpha.ts', 'lib/beta.ts', 'old/one.ts', 'old/two.ts', 'old/three.ts'] },
	])(
		'checkMoveOnlyChanges: a declared move that left a tracked file at its old path is refused naming each path left behind',
		async ({ edits, leftBehind }) => {
			const { run } = setupMoveCheck({
				committed: { 'lib/alpha.ts': 'alpha\n', 'lib/beta.ts': 'beta\n', 'old/one.ts': 'one\n', 'old/two.ts': 'two\n', 'old/three.ts': 'three\n' },
				edits,
			});
			const fileMoves = ['alpha', 'beta'].map((name) => ({ from: `lib/${name}.ts`, to: `core/${name}.ts` }));
			// each line names the path left behind beside its move, a folder move shown with its trailing slash
			const named = leftBehind.map((path) => [path, fileMoves.find(({ from }) => from === path)?.to ?? 'new/']);

			const result = await checkMoveOnlyChanges({ run, checkpoint: 'verify-implement', fileMoves, folderMoves: [{ from: 'old', to: 'new' }] });

			expect(judge({ result, named })).toStrictEqual({ passes: false, named: named.map(() => true) });
		},
	);

	const leftBehindCases: { leftBehind: Record<string, string>; changed: Record<string, string> }[] = [
		{ leftBehind: {}, changed: {} },
		{ leftBehind: { 'web/src/about.ts': 'about\n' }, changed: { 'src/index.js': 'export const one = 2;\n' } },
	];
	test.each(leftBehindCases)(
		'checkMoveOnlyChanges: baseline-dirty and generated paths left at an old path are outside the completeness rule, and every defect is reported in one refusal',
		async ({ leftBehind, changed }) => {
			const { run } = setupMoveCheck({
				committed: { 'web/src/home.ts': 'home\n', 'web/src/routeTree.gen.ts': '[];\n', 'web/src/dirty.ts': '1\n', ...leftBehind },
				edits: { rename: { 'web/src/home.ts': 'web/app/home.ts' }, write: { 'web/src/dirty.ts': '2\n', ...changed } },
				baselineDirtyFiles: ['web/src/dirty.ts'],
				generated: ['web/src/routeTree.gen.ts'],
			});
			// a tracked path left behind is named beside its folder move, and the changed literal by its own path
			const named = [...Object.keys(leftBehind).map((path) => [path, 'web/app/']), ...Object.keys(changed).map((path) => [path])];

			const result = await checkMoveOnlyChanges({ run, checkpoint: 'verify-implement', fileMoves: [], folderMoves: [{ from: 'web/src', to: 'web/app' }] });

			expect(judge({ result, named })).toStrictEqual({ passes: named.length === 0, named: named.map(() => true) });
		},
	);

	test.each([
		{ importPath: './text/format.ts', passes: true, named: [] },
		{ importPath: './strings/format.ts', passes: false, named: [['src/main.ts']] },
	])('checkMoveOnlyChanges: a declared file move and its re-pointed importer pass like a folder move', async ({ importPath, passes, named }) => {
		const { run } = setupMoveCheck({
			committed: { 'src/helpers/format.ts': 'export const format = String;\n', 'src/main.ts': "import { format } from './helpers/format.ts';\n" },
			edits: { rename: { 'src/helpers/format.ts': 'src/text/format.ts' }, write: { 'src/main.ts': `import { format } from '${importPath}';\n` } },
		});
		const fileMoves = [{ from: 'src/helpers/format.ts', to: 'src/text/format.ts' }];

		const result = await checkMoveOnlyChanges({ run, checkpoint: 'verify-implement', fileMoves, folderMoves: [] });

		expect(judge({ result, named })).toStrictEqual({ passes, named: named.map(() => true) });
	});

	test('checkMoveOnlyChanges: a changed file whose token difference holds a token outside the move paths is refused with the tokens it added and removed', async () => {
		const { run } = setupMoveCheck({
			committed: { 'app/widgets/size.ts': "import '../base.ts';\nsize = 2;\n", 'app/main.ts': "import './widgets/size.ts';\ntotal = size;\n" },
			edits: {
				remove: ['app/widgets/size.ts'],
				write: { 'app/ui/widgets/size.ts': "import '../../base.ts';\nsize = 3;\n", 'app/main.ts': "import './ui/widgets/size.ts';\ntotal = size + bonus;\n" },
			},
		});

		const result = await checkMoveOnlyChanges({ run, checkpoint: 'verify-implement', fileMoves: [], folderMoves: [widgetsMove] });

		const movedLine = refusalLine({ result, path: 'app/ui/widgets/size.ts' });
		const editedLine = refusalLine({ result, path: 'app/main.ts' });

		// the moved file traded `2` for `3` and the importer gained `+ bonus`; the
		// re-pointed paths' own tokens are never held against either
		expect({
			moved: ['`3`', '`2`'].every((token) => movedLine.includes(token)),
			edited: ['`bonus`', '`+`'].every((token) => editedLine.includes(token)),
			namesMoveTokens: ['/', '.', '-', 'app', 'ui', 'widgets'].filter((token) => (result.error ?? '').includes(`\`${token}\``)),
		}).toStrictEqual({ moved: true, edited: true, namesMoveTokens: [] });
	});

	test('checkMoveOnlyChanges: an unpaired removal or addition is refused naming the path', async () => {
		const { run } = setupMoveCheck({
			committed: { 'notes/stray.md': 'a stray note\n', 'app/widgets/a.ts': 'a\n', 'app/widgets/b.ts': 'b\n' },
			edits: { rename: { 'app/widgets/a.ts': 'app/ui/widgets/a.ts' }, remove: ['notes/stray.md', 'app/widgets/b.ts'], write: { 'app/extra.ts': 'extra\n' } },
		});
		const named = [['notes/stray.md'], ['app/widgets/b.ts', 'app/ui/widgets/b.ts'], ['app/extra.ts']];

		const result = await checkMoveOnlyChanges({ run, checkpoint: 'verify-implement', fileMoves: [], folderMoves: [widgetsMove] });

		// a move never deletes a file nor creates one, so each unpaired side is refused
		expect(judge({ result, named })).toStrictEqual({ passes: false, named: [true, true, true] });
	});

	test.each([
		{ baselineDirtyFiles: ['app/widgets/draft.ts'], passes: true, named: [] },
		{ baselineDirtyFiles: [], passes: false, named: [['app/ui/widgets/draft.ts']] },
	])(
		'checkMoveOnlyChanges: a file untracked at the phase start that moved with its folder is outside the check only when its source was dirty at the baseline',
		async ({ baselineDirtyFiles, passes, named }) => {
			const { run } = setupMoveCheck({
				committed: { 'app/widgets/a.ts': 'a\n' },
				edits: { untracked: { 'app/widgets/draft.ts': 'draft\n' }, rename: { 'app/widgets': 'app/ui/widgets' } },
				baselineDirtyFiles,
			});

			const result = await checkMoveOnlyChanges({ run, checkpoint: 'verify-implement', fileMoves: [], folderMoves: [widgetsMove] });

			expect(judge({ result, named })).toStrictEqual({ passes, named: named.map(() => true) });
		},
	);

	const leftOutCases: { committed: Record<string, string>; edits: Edits; fileMoves: Move[]; folderMoves: Move[] }[] = [
		{
			committed: { 'app/widgets/a.ts': 'a\n', 'notes/dirty.md': 'written before the run\n', 'packages/web-app/src/routeTree.gen.ts': '[];\n' },
			edits: {
				rename: { 'app/widgets': 'app/ui/widgets' },
				write: {
					'notes/dirty.md': 'rewritten by the user before the run began\n',
					'packages/web-app/src/routeTree.gen.ts': '[home, about];\n',
					'plugin/dist/bundle.js': 'console.log(1);\n',
					'.lightsout/runs/run-1/manifest.json': '{ "runId": "run-1" }\n',
				},
				createdAndDeleted: ['src/scratch.ts'],
			},
			fileMoves: [],
			folderMoves: [widgetsMove],
		},
		{
			committed: { 'packages/web-app/src/home.ts': 'home\n', 'packages/web-app/src/routeTree.gen.ts': '[];\n' },
			edits: { rename: { 'packages/web-app/src': 'packages/web-app/app' } },
			fileMoves: [],
			folderMoves: [{ from: 'packages/web-app/src', to: 'packages/web-app/app' }],
		},
		{
			committed: { 'build/bundle.js': 'console.log(1);\n' },
			edits: { rename: { 'build/bundle.js': 'plugin/dist/bundle.js' } },
			fileMoves: [{ from: 'build/bundle.js', to: 'plugin/dist/bundle.js' }],
			folderMoves: [],
		},
	];
	test.each(leftOutCases)(
		'checkMoveOnlyChanges: baseline-dirty files, generated paths, run state and files created and deleted within the run are left out',
		async ({ committed, edits, fileMoves, folderMoves }) => {
			const { run } = setupMoveCheck({ committed, edits, baselineDirtyFiles: ['notes/dirty.md'], generated: generatedPaths });

			const result = await checkMoveOnlyChanges({ run, checkpoint: 'verify-implement', fileMoves, folderMoves });

			expect(result).toStrictEqual({});
		},
	);

	test('checkMoveOnlyChanges: refuses when git cannot report the working changes', async () => {
		const { run } = setupMoveCheck({ git: false, edits: { write: { 'src/extra.ts': 'export const extra = 1;\n' } } });

		const result = await checkMoveOnlyChanges({ run, checkpoint: 'verify-implement', fileMoves: [], folderMoves: [widgetsMove] });

		// no git truth means nothing is proven, so the check fails closed
		expect(result).toEqual({ error: expect.stringMatching(/working changes/) });
	});

	test("checkMoveOnlyChanges: refuses when git cannot read the phase's starting commit", async () => {
		const { run, progressLines } = setupMoveCheck({ unbornHead: true });

		const result = await checkMoveOnlyChanges({ run, checkpoint: 'verify-implement', fileMoves: [], folderMoves: [widgetsMove] });

		// git reports every file added, but with no commit to compare against nothing is proven and no file is judged
		expect({
			namesStartingCommit: /^verify-implement: .*starting commit.*no gate ran/.test(result.error ?? ''),
			progressLines,
		}).toStrictEqual({ namesStartingCommit: true, progressLines: [] });
	});

	test('checkMoveOnlyChanges: a rewritten file lists at most twenty disallowed tokens and counts the rest', async () => {
		const words = Array.from({ length: 25 }, (_, index) => `word${index}`);
		const { run } = setupMoveCheck({
			committed: { 'notes/widget.md': 'widget\n' },
			edits: { rename: { notes: 'docs' }, write: { 'docs/widget.md': `widget ${words.join(' ')}\n` } },
		});

		const result = await checkMoveOnlyChanges({ run, checkpoint: 'verify-implement', fileMoves: [], folderMoves: [{ from: 'notes', to: 'docs' }] });

		const refusal = refusalLine({ result, path: 'docs/widget.md' });

		// one rewritten file cannot bury the others: twenty named, the other five counted
		expect({
			named: words.filter((word) => refusal.includes(`\`${word}\``)).length,
			countsTheRest: /\b5 more\b/.test(refusal),
		}).toStrictEqual({ named: 20, countsTheRest: true });
	});

	test('checkMoveOnlyChanges: narrates the checkpoint and the file count when it starts, and a pass when every file holds', async () => {
		const { run, progressLines } = setupMoveCheck({ committed: { 'src/gone.ts': 'gone\n' }, edits: { rename: { 'src/gone.ts': 'src/here.ts' } } });

		await checkMoveOnlyChanges({ run, checkpoint: 'verify-tests', fileMoves: [{ from: 'src/gone.ts', to: 'src/here.ts' }], folderMoves: [] });

		// one removal and one addition: two changed files
		expect(progressLines).toEqual([expect.stringMatching(/^verify-tests: .*\b2\b/), expect.stringMatching(/^verify-tests: /)]);
	});
});
