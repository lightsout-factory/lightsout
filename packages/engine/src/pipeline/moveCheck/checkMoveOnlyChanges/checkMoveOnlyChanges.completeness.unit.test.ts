import { describe, expect, test } from '@jest/globals';
import { checkMoveOnlyChanges } from '#src/pipeline/moveCheck/checkMoveOnlyChanges/checkMoveOnlyChanges.ts';
import { generatedPaths } from '#tests/helpers/generatedPaths.ts';
import { setupMoveCheck } from '#tests/helpers/setupMoveCheck.ts';

type Edits = NonNullable<NonNullable<Parameters<typeof setupMoveCheck>[0]>['edits']>;

interface Move {
	from: string;
	to: string;
}

const widgetsMove: Move = { from: 'app/widgets', to: 'app/ui/widgets' };

const refusalLines = ({ result }: { result: { error?: string } }) => (result.error ?? '').split('\n');

/** Whether the check passed, and for each group of paths whether one refusal line names them all. */
const judge = ({ result, named }: { result: { error?: string }; named: string[][] }) => ({
	passes: Object.keys(result).length === 0,
	named: named.map((parts) => refusalLines({ result }).some((line) => parts.every((part) => line.includes(part)))),
});

describe('checkMoveOnlyChanges', () => {
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
});
