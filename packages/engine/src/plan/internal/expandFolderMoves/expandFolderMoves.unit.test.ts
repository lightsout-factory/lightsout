import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { BuildMode } from '#src/common/constants/BuildMode.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';
import type { PhaseFile } from '#src/plan/common/types/PhaseFile.ts';
import { expandFolderMoves } from '#src/plan/internal/expandFolderMoves/expandFolderMoves.ts';
import { getRejectionError } from '#tests/helpers/getRejectionError.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';
import { writeRepoFile } from '#tests/helpers/writeRepoFile.ts';

type Move = { from: string; to: string };

interface PhaseSpec {
	base: string;
	create?: string[];
	remove?: string[];
	move?: Move[];
	/** Folder moves as the parser keeps them: no trailing `/`. */
	folderMoves?: Move[];
}

/** A parsed plan carrying only the path collections the expander folds over. */
const planWith = ({ base, create = [], remove = [], move = [], folderMoves = [] }: PhaseSpec): PhaseFile['plan'] => ({
	base,
	title: 'Phase',
	variant: 'implementable',
	sections: new Map(),
	createPaths: create,
	modifyPaths: [],
	earlierPhaseModifyPaths: [],
	deletePaths: remove,
	movePaths: move,
	folderMoves,
	malformedMoveLines: [],
	generatedRegionRanges: new Map(),
	sectionRanges: new Map(),
	mirrorPaths: [],
	verificationCommands: [],
	ledger: [],
	malformedLedgerLines: [],
	proseFiles: [],
	malformedProseLines: [],
	buildMode: BuildMode.Standard,
	renames: [],
	malformedRenameLines: [],
	lines: [],
});

/** The phases in the order given, numbered from 1 — the order the expander's callers sort them into. */
const phaseFiles = ({ specs }: { specs: PhaseSpec[] }): PhaseFile[] =>
	specs.map((spec, index) => ({ path: `/plans/demo/${spec.base}`, base: spec.base, number: index + 1, plan: planWith(spec) }));

/** A file body with no export, so the fixture repo plants no consumer beside it and tracks exactly the files named. */
const body = 'const value = 1;\n';

/**
 * A committed repo tracking exactly `tracked`, with `untracked` files written
 * after the commit and `emptyFolders` made on disk holding no file at all.
 */
const setupExpansion = ({
	tracked = [],
	untracked = [],
	emptyFolders = [],
	specs,
}: {
	tracked?: string[];
	untracked?: string[];
	emptyFolders?: string[];
	specs: PhaseSpec[];
}) => {
	const cwd = setupConsumerRepo({ sources: Object.fromEntries(tracked.map((path) => [path, body])) });

	for (const path of untracked) {
		writeRepoFile({ cwd, path, content: body });
	}

	for (const folder of emptyFolders) {
		mkdirSync(join(cwd, folder, 'nested'), { recursive: true });
	}

	return { cwd, phases: phaseFiles({ specs }) };
};

/**
 * A directory outside any git worktree, and three plans read there: one with
 * no folder move and nothing overlapping, one holding a swapped file pair
 * beside an unrelated move, and one with a folder move git cannot list.
 */
const setupWithoutGit = () => {
	const cwd = setupConsumerRepo({ git: false, sources: {} });
	const clean = phaseFiles({
		specs: [
			{ base: 'phase1-core.md', create: ['src/core.ts'], move: [{ from: 'src/a.ts', to: 'src/b.ts' }] },
			{ base: 'phase2-extra.md', remove: ['src/gone.ts'] },
		],
	});
	const swapped = phaseFiles({
		specs: [
			{
				base: 'phase1-swap.md',
				move: [
					{ from: 'src/x.ts', to: 'src/y.ts' },
					{ from: 'src/y.ts', to: 'src/x.ts' },
					{ from: 'src/z.ts', to: 'src/w.ts' },
				],
			},
		],
	});
	const folder = phaseFiles({ specs: [{ base: 'phase1-move.md', folderMoves: [{ from: 'src/old', to: 'src/new' }] }] });

	return { cwd, clean, swapped, folder };
};

/** Each finding as the fields the cases pin, in a fixed order; the issue and fix wording is human-facing and left free. */
const reported = ({ findings }: { findings: StructuralFinding[] }) =>
	findings
		.map(({ check, severity, phase, location }) => ({ check, severity, phase, location }))
		.sort((left, right) => left.location.localeCompare(right.location));

/** Carried moves in path order, since the order git lists a folder's files in is not part of the contract. */
const byFrom = ({ moves }: { moves: Move[] }) => [...moves].sort((left, right) => left.from.localeCompare(right.from));

describe('expandFolderMoves', () => {
	test('expandFolderMoves: a folder move carries every file git tracks under its source as a file move to the matching destination path', async () => {
		const { cwd, phases } = setupExpansion({
			tracked: ['src/old/a.ts', 'src/old/deep/b.ts', 'src/keep.ts'],
			specs: [{ base: 'phase1-move.md', move: [{ from: 'src/keep.ts', to: 'src/kept.ts' }], folderMoves: [{ from: 'src/old', to: 'src/new' }] }],
		});

		const expanded = await expandFolderMoves({ cwd, phases });

		expect({
			own: expanded.phases[0]?.plan.movePaths.slice(0, 1),
			carried: byFrom({ moves: expanded.phases[0]?.plan.movePaths.slice(1) ?? [] }),
			folderMoves: expanded.phases[0]?.plan.folderMoves,
			findings: expanded.findings,
		}).toStrictEqual({
			own: [{ from: 'src/keep.ts', to: 'src/kept.ts' }],
			carried: [
				{ from: 'src/old/a.ts', to: 'src/new/a.ts' },
				{ from: 'src/old/deep/b.ts', to: 'src/new/deep/b.ts' },
			],
			folderMoves: [{ from: 'src/old', to: 'src/new' }],
			findings: [],
		});
	});

	test('expandFolderMoves: a folder move carries files earlier phases add under its source and drops files earlier phases remove', async () => {
		const { cwd, phases } = setupExpansion({
			tracked: ['src/old/gone.ts', 'src/old/kept.ts'],
			specs: [
				{ base: 'phase1-prepare.md', create: ['src/old/added.ts'], remove: ['src/old/gone.ts'] },
				{ base: 'phase2-move.md', folderMoves: [{ from: 'src/old', to: 'src/new' }] },
			],
		});

		const expanded = await expandFolderMoves({ cwd, phases });

		expect({
			first: expanded.phases[0],
			carried: byFrom({ moves: expanded.phases[1]?.plan.movePaths ?? [] }),
			findings: expanded.findings,
		}).toStrictEqual({
			first: phases[0],
			carried: [
				{ from: 'src/old/added.ts', to: 'src/new/added.ts' },
				{ from: 'src/old/kept.ts', to: 'src/new/kept.ts' },
			],
			findings: [],
		});
	});

	test('expandFolderMoves: a folder move into its own source is one finding at its heading and carries nothing', async () => {
		const { cwd, phases } = setupExpansion({
			tracked: ['src/old/a.ts'],
			specs: [{ base: 'phase1-move.md', folderMoves: [{ from: 'src/old', to: 'src/old/inner' }] }],
		});

		const expanded = await expandFolderMoves({ cwd, phases });

		expect({ findings: reported(expanded), movePaths: expanded.phases[0]?.plan.movePaths }).toStrictEqual({
			findings: [{ check: 'move-well-formed', severity: 'blocking', phase: 'phase1-move.md', location: 'phase1-move.md → src/old/' }],
			movePaths: [],
		});
	});

	test('expandFolderMoves: a destination folder that already exists is one finding and carries nothing, unless earlier phases emptied it', async () => {
		const { cwd, phases } = setupExpansion({
			tracked: ['src/a/one.ts', 'src/b/two.ts', 'src/c/three.ts', 'src/e/five.ts', 'src/f/six.ts'],
			specs: [
				{ base: 'phase1-prepare.md', create: ['src/d/new.ts'], move: [{ from: 'src/f/six.ts', to: 'src/moved/six.ts' }] },
				{
					base: 'phase2-move.md',
					folderMoves: [
						{ from: 'src/a', to: 'src/b' },
						{ from: 'src/c', to: 'src/d' },
						{ from: 'src/e', to: 'src/f' },
					],
				},
			],
		});

		const expanded = await expandFolderMoves({ cwd, phases });

		expect({ findings: reported(expanded), movePaths: expanded.phases[1]?.plan.movePaths }).toStrictEqual({
			findings: [
				{ check: 'move-well-formed', severity: 'blocking', phase: 'phase2-move.md', location: 'phase2-move.md → src/a/' },
				{ check: 'move-well-formed', severity: 'blocking', phase: 'phase2-move.md', location: 'phase2-move.md → src/c/' },
			],
			movePaths: [{ from: 'src/e/five.ts', to: 'src/f/five.ts' }],
		});
	});

	test('expandFolderMoves: a destination folder holding untracked files on disk already exists', async () => {
		const { cwd, phases } = setupExpansion({
			tracked: ['src/s1/one.ts', 'src/s2/two.ts', 'src/s3/three.ts', 'src/s4/four.ts', 'src/s5/five.ts', 'src/d4'],
			untracked: ['src/d1/stray.ts', 'src/d5'],
			emptyFolders: ['src/d3'],
			specs: [
				{
					base: 'phase1-move.md',
					folderMoves: [
						{ from: 'src/s1', to: 'src/d1' },
						{ from: 'src/s2', to: 'src/d2' },
						{ from: 'src/s3', to: 'src/d3' },
						{ from: 'src/s4', to: 'src/d4' },
						{ from: 'src/s5', to: 'src/d5' },
					],
				},
			],
		});

		const expanded = await expandFolderMoves({ cwd, phases });

		expect({ findings: reported(expanded), movePaths: byFrom({ moves: expanded.phases[0]?.plan.movePaths ?? [] }) }).toStrictEqual({
			findings: [
				{ check: 'move-well-formed', severity: 'blocking', phase: 'phase1-move.md', location: 'phase1-move.md → src/s1/' },
				{ check: 'move-well-formed', severity: 'blocking', phase: 'phase1-move.md', location: 'phase1-move.md → src/s4/' },
				{ check: 'move-well-formed', severity: 'blocking', phase: 'phase1-move.md', location: 'phase1-move.md → src/s5/' },
			],
			movePaths: [
				{ from: 'src/s2/two.ts', to: 'src/d2/two.ts' },
				{ from: 'src/s3/three.ts', to: 'src/d3/three.ts' },
			],
		});
	});

	test('expandFolderMoves: a folder move whose source carries no files is one finding and carries nothing', async () => {
		const { cwd, phases } = setupExpansion({
			tracked: ['src/other.ts'],
			untracked: ['src/empty/draft.ts'],
			specs: [{ base: 'phase1-move.md', folderMoves: [{ from: 'src/empty', to: 'src/new' }] }],
		});

		const expanded = await expandFolderMoves({ cwd, phases });

		expect({ findings: reported(expanded), movePaths: expanded.phases[0]?.plan.movePaths }).toStrictEqual({
			findings: [{ check: 'move-well-formed', severity: 'blocking', phase: 'phase1-move.md', location: 'phase1-move.md → src/empty/' }],
			movePaths: [],
		});
	});

	test('expandFolderMoves: phases with no folder move pass through untouched without git, and a folder move git cannot list stops the check with an error', async () => {
		const { cwd, clean, swapped, folder } = setupWithoutGit();

		const [cleanResult, swappedResult, rejection] = await Promise.all([
			expandFolderMoves({ cwd, phases: clean }),
			expandFolderMoves({ cwd, phases: swapped }),
			getRejectionError({ promise: expandFolderMoves({ cwd, phases: folder }) }),
		]);

		expect({
			clean: cleanResult,
			swapped: {
				findings: reported(swappedResult),
				checked: swappedResult.phases[0]?.plan.movePaths,
				provenance: swappedResult.provenancePhases[0]?.plan.movePaths,
			},
			error: { namesDirectory: rejection.message.includes(cwd), namesWorkingTree: /working tree/i.test(rejection.message) },
		}).toStrictEqual({
			clean: { phases: clean, provenancePhases: clean, findings: [] },
			swapped: {
				findings: [{ check: 'move-well-formed', severity: 'blocking', phase: 'phase1-swap.md', location: 'phase1-swap.md → Files to Move' }],
				checked: [{ from: 'src/z.ts', to: 'src/w.ts' }],
				provenance: [
					{ from: 'src/x.ts', to: 'src/y.ts' },
					{ from: 'src/y.ts', to: 'src/x.ts' },
					{ from: 'src/z.ts', to: 'src/w.ts' },
				],
			},
			error: { namesDirectory: true, namesWorkingTree: true },
		});
	});

	test('expandFolderMoves: moves in a reported overlapping pair are left out of the expansion, so the overlap finding is the only finding about them', async () => {
		const { cwd, phases } = setupExpansion({
			tracked: ['src/a/one.ts', 'src/b/two.ts', 'src/f1.ts', 'src/f2.ts'],
			specs: [
				{
					base: 'phase1-chain.md',
					move: [
						{ from: 'src/f1.ts', to: 'src/f2.ts' },
						{ from: 'src/f2.ts', to: 'src/f3.ts' },
					],
					folderMoves: [
						{ from: 'src/a', to: 'src/b' },
						{ from: 'src/b', to: 'src/c' },
					],
				},
			],
		});

		const expanded = await expandFolderMoves({ cwd, phases });

		expect({ findings: reported(expanded), movePaths: expanded.phases[0]?.plan.movePaths }).toStrictEqual({
			findings: [
				{ check: 'move-well-formed', severity: 'blocking', phase: 'phase1-chain.md', location: 'phase1-chain.md → Files to Move' },
				{ check: 'move-well-formed', severity: 'blocking', phase: 'phase1-chain.md', location: 'phase1-chain.md → Files to Move' },
			],
			movePaths: [],
		});
	});

	test("expandFolderMoves: a defective or flagged move still provides its would-be paths to later phases through provenancePhases, while its own phase's checked plan leaves it out", async () => {
		const { cwd, phases } = setupExpansion({
			tracked: ['src/old/a.ts', 'src/new/existing.ts', 'src/x.ts', 'src/y.ts'],
			specs: [
				{
					base: 'phase1-move.md',
					move: [
						{ from: 'src/x.ts', to: 'src/y.ts' },
						{ from: 'src/y.ts', to: 'src/x.ts' },
					],
					folderMoves: [{ from: 'src/old', to: 'src/new' }],
				},
				{ base: 'phase2-onward.md', folderMoves: [{ from: 'src/new', to: 'src/newer' }] },
			],
		});

		const expanded = await expandFolderMoves({ cwd, phases });

		expect({
			checkedFirst: expanded.phases[0]?.plan.movePaths,
			provenanceFirst: expanded.provenancePhases[0]?.plan.movePaths,
			checkedSecond: byFrom({ moves: expanded.phases[1]?.plan.movePaths ?? [] }),
			findings: reported(expanded),
		}).toStrictEqual({
			checkedFirst: [],
			provenanceFirst: [
				{ from: 'src/x.ts', to: 'src/y.ts' },
				{ from: 'src/y.ts', to: 'src/x.ts' },
				{ from: 'src/old/a.ts', to: 'src/new/a.ts' },
			],
			checkedSecond: [
				{ from: 'src/new/a.ts', to: 'src/newer/a.ts' },
				{ from: 'src/new/existing.ts', to: 'src/newer/existing.ts' },
			],
			// the swapped pair's own overlap finding sits beside the heading finding;
			// the later phase relying on what phase 1 would have moved gets none
			findings: [
				{ check: 'move-well-formed', severity: 'blocking', phase: 'phase1-move.md', location: 'phase1-move.md → Files to Move' },
				{ check: 'move-well-formed', severity: 'blocking', phase: 'phase1-move.md', location: 'phase1-move.md → src/old/' },
			],
		});
	});
});
