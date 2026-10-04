import { describe, expect, test } from '@jest/globals';
import { FindingSeverity } from '#src/contracts/plan/grade/FindingSeverity.ts';
import { StructuralCheck } from '#src/contracts/plan/grade/StructuralCheck.ts';
import { checkMoveOverlaps } from '#src/plan/common/expandFolderMoves/checkMoveOverlaps.ts';
import { parsePlan } from '#src/plan/parsePlan/parsePlan.ts';
import { phaseBody } from '#tests/helpers/phasePlan.ts';

/** The phase file every case labels its findings with. */
const phase = 'phase1-demo.md';

/**
 * A phase file whose `## Files to Move` holds one heading per move, written as
 * the plan writes them — a folder with its trailing `/` — parsed as the lint
 * parses it, so file moves land in `movePaths` and folder moves in `folderMoves`.
 */
const setupPlan = ({ moves }: { moves: { from: string; to: string }[] }) => {
	const plan = parsePlan({ content: phaseBody({ move: moves }), base: phase });
	const writtenPaths = moves.flatMap(({ from, to }) => [from, to]);

	return { plan, writtenPaths };
};

/**
 * Each finding as the fields the cases assert on, plus whether its issue names
 * every path the case's moves were written with; the rest of the issue and fix
 * wording is human-facing and left free.
 */
const reported = ({ plan, writtenPaths }: ReturnType<typeof setupPlan>) =>
	checkMoveOverlaps({ plan, phase }).findings.map(({ check, severity, phase: label, location, issue }) => ({
		check,
		severity,
		phase: label,
		location,
		namesBothMoves: writtenPaths.every((path) => issue.includes(path)),
	}));

/** The one finding a defective pair gives, naming both of its moves. */
const pairFinding = {
	check: StructuralCheck.MoveWellFormed,
	severity: FindingSeverity.Blocking,
	phase,
	location: `${phase} → Files to Move`,
	namesBothMoves: true,
};

describe('checkMoveOverlaps', () => {
	test('checkMoveOverlaps: two moves whose sources or destinations overlap are one blocking finding naming both moves', () => {
		const sameSource = setupPlan({
			moves: [
				{ from: 'src/x.ts', to: 'src/y.ts' },
				{ from: 'src/x.ts', to: 'src/z.ts' },
			],
		});
		const fileInsideFolderSource = setupPlan({
			moves: [
				{ from: 'src/old/a.ts', to: 'src/a.ts' },
				{ from: 'src/old/', to: 'src/new/' },
			],
		});
		const overlappingDestinations = setupPlan({
			moves: [
				{ from: 'src/p.ts', to: 'lib/out/q.ts' },
				{ from: 'src/r/', to: 'lib/out/' },
			],
		});

		const findings = [sameSource, fileInsideFolderSource, overlappingDestinations].map((arranged) => reported(arranged));

		expect(findings).toStrictEqual([[pairFinding], [pairFinding], [pairFinding]]);
	});

	test('checkMoveOverlaps: a chained or swapped pair of moves is one blocking finding naming both moves', () => {
		const chained = setupPlan({
			moves: [
				{ from: 'src/a/', to: 'src/b/' },
				{ from: 'src/b/', to: 'src/c/' },
			],
		});
		const swapped = setupPlan({
			moves: [
				{ from: 'src/x.ts', to: 'src/y.ts' },
				{ from: 'src/y.ts', to: 'src/x.ts' },
			],
		});

		const findings = [chained, swapped].map((arranged) => reported(arranged));

		expect(findings).toStrictEqual([[pairFinding], [pairFinding]]);
	});

	test('checkMoveOverlaps: flagged lists every move in a reported pair once and no other move', () => {
		const { plan } = setupPlan({
			moves: [
				{ from: 'src/a/', to: 'src/b/' },
				{ from: 'src/b/', to: 'src/c/' },
				{ from: 'src/lone.ts', to: 'lib/lone.ts' },
			],
		});

		const { flagged } = checkMoveOverlaps({ plan, phase });

		expect([...flagged].sort((left, right) => left.from.localeCompare(right.from))).toStrictEqual([
			{ from: 'src/a', to: 'src/b' },
			{ from: 'src/b', to: 'src/c' },
		]);
	});

	test('checkMoveOverlaps: disjoint moves, including sibling folders sharing a name prefix, are silent', () => {
		const { plan: disjoint } = setupPlan({
			moves: [
				{ from: 'src/a/', to: 'lib/a/' },
				{ from: 'src/ab/', to: 'lib/ab/' },
				{ from: 'src/x.ts', to: 'lib/x.ts' },
			],
		});
		const { plan: single } = setupPlan({ moves: [{ from: 'src/a/', to: 'src/b/' }] });

		const results = [disjoint, single].map((plan) => checkMoveOverlaps({ plan, phase }));

		expect(results).toStrictEqual([
			{ findings: [], flagged: [] },
			{ findings: [], flagged: [] },
		]);
	});
});
