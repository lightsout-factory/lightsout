import { describe, expect, jest, test } from '@jest/globals';
import { checkMoveOnlyChanges } from '#src/pipeline/moveCheck/checkMoveOnlyChanges/checkMoveOnlyChanges.ts';
import { setupMoveCheck } from '#tests/helpers/setupMoveCheck.ts';

type CountTokens = (params: { text: string }) => Map<string, number>;

// Mocked Imports
// -------------------------
const mockCountTokens = jest.fn<CountTokens>();
const { countTokens } = jest.requireActual<{ countTokens: CountTokens }>('#src/pipeline/common/countTokens.ts');

jest.mock('#src/pipeline/common/countTokens.ts', () => ({ countTokens: (params: { text: string }) => mockCountTokens(params) }));
// -------------------------

const widgetsMove = { from: 'app/widgets', to: 'app/ui/widgets' };
const assetsMove = { from: 'assets', to: 'media' };
const binaryBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0xff, 0xfe, 0x00, 0x80, 0x41]);

const refusalLines = ({ result }: { result: { error?: string } }) => (result.error ?? '').split('\n');

/** Whether the check passed, and for each group of paths whether one refusal line names them all. */
const judge = ({ result, named }: { result: { error?: string }; named: string[][] }) => ({
	passes: Object.keys(result).length === 0,
	named: named.map((parts) => refusalLines({ result }).some((line) => parts.every((part) => line.includes(part)))),
});

const refusalLine = ({ result, path }: { result: { error?: string }; path: string }) => refusalLines({ result }).find((line) => line.includes(path)) ?? '';

const tokenizedTexts = ({ marker }: { marker: string }) => mockCountTokens.mock.calls.filter(([{ text }]) => text.includes(marker)).length;

/** The move-check fixture, with every text the check tokenizes passing through the real `countTokens`, observed by the mock. */
const setupCheck = (params: Parameters<typeof setupMoveCheck>[0]) => {
	mockCountTokens.mockImplementation(countTokens);

	return setupMoveCheck(params);
};

describe('checkMoveOnlyChanges', () => {
	test.each([
		{ leftUnadded: [], passes: true, named: [] },
		{ leftUnadded: ['app/ui/widgets/card.ts'], passes: false, named: [['app/widgets/card.ts']] },
	])(
		'checkMoveOnlyChanges: a folder moved with its relative imports re-deepened and its importers re-pointed passes',
		async ({ leftUnadded, passes, named }) => {
			const { run } = setupCheck({
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
		const { run } = setupCheck({
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
		const { run } = setupCheck({
			committed: { 'build.json': '{\n\t"rootDir": "src",\n\t"main": "src/index.ts"\n}\n' },
			edits: { rename: { src: 'lib' }, write: { 'build.json': '{\n\t"rootDir": "lib",\n\t"main": "lib/index.ts"\n}\n' } },
		});

		const result = await checkMoveOnlyChanges({ run, checkpoint: 'verify-implement', fileMoves: [], folderMoves: [{ from: 'src', to: 'lib' }] });

		expect(result).toStrictEqual({});
	});

	test('checkMoveOnlyChanges: a file moved with identical content passes by blob id without being tokenized', async () => {
		const { run } = setupCheck({
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
		const { run } = setupCheck({
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
		{ importPath: './text/format.ts', passes: true, named: [] },
		{ importPath: './strings/format.ts', passes: false, named: [['src/main.ts']] },
	])('checkMoveOnlyChanges: a declared file move and its re-pointed importer pass like a folder move', async ({ importPath, passes, named }) => {
		const { run } = setupCheck({
			committed: { 'src/helpers/format.ts': 'export const format = String;\n', 'src/main.ts': "import { format } from './helpers/format.ts';\n" },
			edits: { rename: { 'src/helpers/format.ts': 'src/text/format.ts' }, write: { 'src/main.ts': `import { format } from '${importPath}';\n` } },
		});
		const fileMoves = [{ from: 'src/helpers/format.ts', to: 'src/text/format.ts' }];

		const result = await checkMoveOnlyChanges({ run, checkpoint: 'verify-implement', fileMoves, folderMoves: [] });

		expect(judge({ result, named })).toStrictEqual({ passes, named: named.map(() => true) });
	});

	test('checkMoveOnlyChanges: a changed file whose token difference holds a token outside the move paths is refused with the tokens it added and removed', async () => {
		const { run } = setupCheck({
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

	test('checkMoveOnlyChanges: refuses when git cannot report the working changes', async () => {
		const { run } = setupCheck({ git: false, edits: { write: { 'src/extra.ts': 'export const extra = 1;\n' } } });

		const result = await checkMoveOnlyChanges({ run, checkpoint: 'verify-implement', fileMoves: [], folderMoves: [widgetsMove] });

		// no git truth means nothing is proven, so the check fails closed
		expect(result).toEqual({ error: expect.stringMatching(/working changes/) });
	});

	test("checkMoveOnlyChanges: refuses when git cannot read the phase's starting commit", async () => {
		const { run, progressLines } = setupCheck({ unbornHead: true });

		const result = await checkMoveOnlyChanges({ run, checkpoint: 'verify-implement', fileMoves: [], folderMoves: [widgetsMove] });

		// git reports every file added, but with no commit to compare against nothing is proven and no file is judged
		expect({
			namesStartingCommit: /^verify-implement: .*starting commit.*no gate ran/.test(result.error ?? ''),
			progressLines,
		}).toStrictEqual({ namesStartingCommit: true, progressLines: [] });
	});

	test('checkMoveOnlyChanges: a rewritten file lists at most twenty disallowed tokens and counts the rest', async () => {
		const words = Array.from({ length: 25 }, (_, index) => `word${index}`);
		const { run } = setupCheck({
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
		const { run, progressLines } = setupCheck({ committed: { 'src/gone.ts': 'gone\n' }, edits: { rename: { 'src/gone.ts': 'src/here.ts' } } });

		await checkMoveOnlyChanges({ run, checkpoint: 'verify-tests', fileMoves: [{ from: 'src/gone.ts', to: 'src/here.ts' }], folderMoves: [] });

		// one removal and one addition: two changed files
		expect(progressLines).toEqual([expect.stringMatching(/^verify-tests: .*\b2\b/), expect.stringMatching(/^verify-tests: /)]);
	});
});
