import { expect, jest, test } from '@jest/globals';
import { renderStepTable } from '#src/cli/internal/common/render/renderStepTable.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { StepSummary } from '#src/runState/common/types/StepSummary.ts';

// The table's whole output IS its returned lines. isTTY is pinned off so the
// ANSI paint helpers stay no-ops and the assertions read the plain text a
// piped consumer sees. stdout is watched so a case can pin that rendering
// prints nothing.
const setupStepTable = ({ steps }: { steps: StepSummary[] }) => {
	const printed: string[] = [];

	process.stdout.isTTY = false;

	jest.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
		printed.push(String(args[0]));
	});
	jest.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
		printed.push(String(chunk));

		return true;
	});

	return { steps, printed };
};

/** Row cells with the alignment padding stripped — the content contract, read apart from the column widths the geometry test pins. */
const cellsOf = ({ lines }: { lines: string[] }) =>
	lines
		.filter((line) => line.startsWith('│'))
		.map((line) =>
			line
				.split('│')
				.slice(1, -1)
				.map((cell) => cell.trim()),
		);

test('renderStepTable: returns the table as lines and prints nothing', () => {
	const { steps, printed } = setupStepTable({
		steps: [
			{
				id: 'implement',
				status: RunStatus.Passed,
				attempts: 1,
				durationMs: 2000,
				changedFiles: ['src/a.ts'],
				invocations: 1,
				outputTokens: 200,
				costUsd: 0.25,
			},
			{
				id: 'write-tests',
				status: RunStatus.Failed,
				attempts: 2,
				durationMs: 3000,
				changedFiles: ['src/a.unit.test.ts', 'src/b.unit.test.ts'],
				invocations: 2,
				outputTokens: 300,
				costUsd: 0.5,
			},
		],
	});

	const lines = renderStepTable({ steps, activeMs: 5000 });

	expect({ cells: cellsOf({ lines }), printed }).toStrictEqual({
		cells: [
			['step', 'tries', 'time', 'agents', 'out', 'cost', 'files'],
			['✓ implement', '1', '2s', '1', '200', '$0.25', '1'],
			['✗ write-tests', '2', '3s', '2', '300', '$0.50', '2'],
			['total', '—', '5s', '3', '500', '$0.75', '3'],
		],
		printed: [],
	});
});

test('renderStepTable: a step with agent activity fills every column, and the total row sums the steps', () => {
	const { steps } = setupStepTable({
		steps: [
			{
				id: 'implement',
				status: RunStatus.Passed,
				attempts: 1,
				durationMs: 65000,
				changedFiles: ['src/a.ts', 'src/b.ts'],
				invocations: 2,
				outputTokens: 1500,
				costUsd: 0.5,
			},
			{
				id: 'write-tests',
				status: RunStatus.Pending,
				attempts: 0,
				durationMs: undefined,
				changedFiles: undefined,
				invocations: 0,
				outputTokens: 0,
				costUsd: 0,
			},
		],
	});

	const lines = renderStepTable({ steps, activeMs: 65000 });

	expect(cellsOf({ lines })).toStrictEqual([
		['step', 'tries', 'time', 'agents', 'out', 'cost', 'files'],
		['✓ implement', '1', '1m 05s', '2', '1.5k', '$0.50', '2'],
		['○ write-tests', '0', '—', '—', '—', '—', '—'],
		['total', '—', '1m 05s', '2', '1.5k', '$0.50', '2'],
	]);
});

test('renderStepTable: a run with no agent invocations dashes out the agent columns, and an explicit empty change list still counts as zero', () => {
	const { steps } = setupStepTable({
		steps: [{ id: 'clean-slate', status: RunStatus.Failed, attempts: 2, durationMs: undefined, changedFiles: [], invocations: 0, outputTokens: 0, costUsd: 0 }],
	});

	const lines = renderStepTable({ steps, activeMs: 0 });

	expect(cellsOf({ lines })).toStrictEqual([
		['step', 'tries', 'time', 'agents', 'out', 'cost', 'files'],
		['✗ clean-slate', '2', '—', '—', '—', '—', '0'],
		['total', '—', '—', '—', '—', '—', '0'],
	]);
});

test('renderStepTable: a status this build has no icon for falls back to a question mark rather than blanking the cell', () => {
	const { steps } = setupStepTable({
		// Every status in the union has an icon — the table is typed to make sure
		// of it. This is the case that outlives that guarantee: a manifest written
		// by a newer build, read back by an older one, carries a status string this
		// build has never heard of. Cast, because no honest value can express it.
		steps: [
			{
				id: 'park',
				status: 'from-a-later-build' as RunStatus,
				attempts: 1,
				durationMs: undefined,
				changedFiles: undefined,
				invocations: 0,
				outputTokens: 0,
				costUsd: 0,
			},
		],
	});

	const lines = renderStepTable({ steps, activeMs: 0 });

	expect(cellsOf({ lines })[1]).toStrictEqual(['? park', '1', '—', '—', '—', '—', '—']);
});

test('renderStepTable: a run with no steps still returns the header and a zeroed total row', () => {
	const { steps } = setupStepTable({ steps: [] });

	const lines = renderStepTable({ steps, activeMs: 0 });

	expect(cellsOf({ lines })).toStrictEqual([
		['step', 'tries', 'time', 'agents', 'out', 'cost', 'files'],
		['total', '—', '—', '—', '—', '—', '0'],
	]);
});

test('renderStepTable: every rule and row is padded to one width, so the box closes over seven columns', () => {
	const { steps } = setupStepTable({
		steps: [
			{
				id: 'implement',
				status: RunStatus.Passed,
				attempts: 1,
				durationMs: 1000,
				changedFiles: ['src/a.ts'],
				invocations: 1,
				outputTokens: 100,
				costUsd: 0.01,
			},
		],
	});

	const lines = renderStepTable({ steps, activeMs: 1000 });

	expect([...new Set(lines.map((line) => line.length))]).toStrictEqual([lines[0]?.length]);
	expect(lines[0] ?? '').toMatch(/^┌─+(┬─+){6}┐$/);
	expect(lines.at(-1) ?? '').toMatch(/^└─+(┴─+){6}┘$/);
});
