import { statusIcons } from '#src/cli/common/constants/statusIcons.ts';
import { formatClockDuration } from '#src/cli/common/formatClockDuration.ts';
import { dim } from '#src/cli/common/terminal/dim.ts';
import { paintStatus } from '#src/cli/common/terminal/paintStatus.ts';
import type { RunProgressRow } from '#src/common/types/RunProgressRow.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';

/** `stopped` marks a running row with no live process behind it — drawn as stopped rather than as work in progress. */
type BlockRow = Pick<RunProgressRow, 'id' | 'status' | 'attempts' | 'durationMs'> & { stopped?: boolean };

const emDash = '—';

const notReachedGlyph = '·';

/** Floors, so every narrower run reproduces the 49-column layout exactly (4 + 21 + 17 + 7). */
const minimumWidths = { id: 21, outcome: 17, duration: 7 };

const layoutGlyphs: Partial<Record<RunStatus, string>> = {
	[RunStatus.Running]: '▶',
	[RunStatus.Pending]: notReachedGlyph,
};

const rowGlyph = ({ status }: { status: RunStatus | undefined }) => (status === undefined ? notReachedGlyph : (layoutGlyphs[status] ?? statusIcons[status]));

/**
 * Plain cells, because an ANSI colour code counts toward `String.length` and
 * occupies no column.
 *
 * An implement run has no record for a step it has not started, while a phased
 * coordinator seeds a `pending` record for every phase; both mean the same to a
 * reader, so both draw the same.
 */
const rowCells = ({ row }: { row: BlockRow }) => {
	if (row.status === undefined || row.status === RunStatus.Pending) {
		return { glyph: rowGlyph({ status: row.status }), status: undefined, id: row.id, outcome: emDash, duration: undefined };
	}

	const glyph = row.stopped === true ? '■' : rowGlyph({ status: row.status });
	const shown = row.stopped === true ? 'stopped' : row.status;
	const outcome = row.attempts > 1 ? `${shown} (x${row.attempts})` : shown;

	return { glyph, status: shown, id: row.id, outcome, duration: formatClockDuration({ ms: row.durationMs }) };
};

interface Params {
	/** Left of the title line. */
	title: string;
	/** Right-aligned on the title line, ending flush with the rule. */
	tag: string;
	rows: BlockRow[];
	/** Complete lines drawn between the rows and the closing rule. */
	diagnostics: string[];
	/** The totals text, without its leading space. */
	totals: string;
	/** The now text, without its label. When undefined, no now line is drawn. */
	now: string | undefined;
}

/**
 * The one layout every progress block shares — a run's, a plan's planning
 * steps, a ship's — and the chat and terminal views are the same bytes.
 */
export const renderProgressBlock = ({ title, tag, rows, diagnostics, totals, now }: Params): string[] => {
	const cells = rows.map((row) => rowCells({ row }));
	const idWidth = Math.max(minimumWidths.id, ...cells.map((cell) => cell.id.length + 2));
	const outcomeWidth = Math.max(minimumWidths.outcome, ...cells.map((cell) => cell.outcome.length + 2));
	const durationWidth = Math.max(minimumWidths.duration, ...cells.map((cell) => cell.duration?.length ?? 0));
	const rowLines = cells.map((cell) => {
		const head = ` ${cell.glyph}  ${cell.id.padEnd(idWidth)}`;

		return cell.duration === undefined ? `${head}${emDash}` : `${head}${cell.outcome.padEnd(outcomeWidth)}${cell.duration.padStart(durationWidth)}`;
	});
	const totalsLine = ` ${totals}`;
	const nowLine = now === undefined ? undefined : ` now  ${now}`;
	const ruleWidth = Math.max(
		...rowLines.map((line) => line.length),
		...diagnostics.map((line) => line.length),
		totalsLine.length,
		nowLine?.length ?? 0,
		// Measured too, or a long title's padding could go negative.
		title.length + tag.length + 1,
	);
	const rule = dim('─'.repeat(ruleWidth));
	const titleLine = `${title}${' '.repeat(Math.max(1, ruleWidth - tag.length - title.length))}${tag}`;
	// Painted after the geometry is settled on the plain text.
	const painted = cells.map((cell, index) => {
		const glyph = cell.status === undefined ? dim(cell.glyph) : paintStatus({ status: cell.status, text: cell.glyph });

		return rowLines[index].replace(cell.glyph, glyph);
	});

	return [titleLine, rule, ...painted, ...diagnostics, rule, totalsLine, ...(nowLine === undefined ? [] : [nowLine])];
};
