import { formatCost } from '@lightsout/shared';
import { formatClockDuration } from '#src/cli/common/formatClockDuration.ts';
import { plural } from '#src/cli/common/plural.ts';
import { renderProgressBlock } from '#src/cli/statusCommand/common/renderProgressBlock.ts';
import type { RunProgress } from '#src/common/types/RunProgress.ts';
import type { RunProgressRow } from '#src/common/types/RunProgressRow.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';

const collapseWhitespace = ({ text }: { text: string }) => text.replace(/\s+/g, ' ').trim();

const wrapLabelled = ({ label, text }: { label: string; text: string }) => {
	// The block's rules span its widest line, so an unwrapped supervisor
	// diagnosis would drag them out to hundreds of characters.
	const diagnosisWidth = 96;
	const indent = ` ${label.padEnd('last output'.length)}   `;
	const width = Math.max(diagnosisWidth - indent.length, 1);
	const lines: string[] = [];
	let rest = text;

	while (rest.length > width) {
		const cut = rest.lastIndexOf(' ', width);
		const at = cut > 0 ? cut : width;

		lines.push(rest.slice(0, at));
		rest = rest.slice(at).trimStart();
	}

	lines.push(rest);

	return lines.map((line, index) => `${index === 0 ? indent : ' '.repeat(indent.length)}${line}`);
};

const verificationLines = ({ row }: { row: RunProgressRow }) => {
	const verification = row.verification;

	if (!verification || verification.failedFamilies.length === 0) {
		return [];
	}

	const groups = [...new Set(verification.failures.map((failure) => failure.group))];
	const repairs = Object.entries(verification.repairAttempts);
	const lastOutput = verification.failures
		.at(-1)
		?.outputTail?.split(/\r?\n/)
		.map((line) => collapseWhitespace({ text: line }))
		.filter(Boolean)
		.at(-1);
	const lines = [
		` verification  ${verification.failedFamilies.join(', ')} · groups ${groups.length === 0 ? 'unavailable' : groups.join(', ')} · repairs ${repairs.length === 0 ? 'none' : repairs.map(([family, attempts]) => `${family}=${attempts}`).join(', ')} · guided ${verification.guidedRepairAttempted ? 'yes' : 'no'}`,
	];

	if (verification.supervisorDiagnosis) {
		lines.push(...wrapLabelled({ label: 'diagnosis', text: collapseWhitespace({ text: verification.supervisorDiagnosis }) }));
	}

	if (lastOutput) {
		lines.push(` last output   ${lastOutput}`);
	}

	return lines;
};

const cleanupLines = ({ row }: { row: RunProgressRow }) => {
	const cleanup = row.cleanup;

	if (cleanup === undefined) {
		return [];
	}

	const parts = [`${cleanup.rounds} round${plural({ count: cleanup.rounds })}`, cleanup.endReason ?? 'in progress'];

	if (cleanup.remainingFindings > 0) {
		parts.push(`remaining ${cleanup.remainingFindings}`);
	}

	if (cleanup.carriedFindings > 0) {
		parts.push(`carried ${cleanup.carriedFindings}`);
	}

	if (cleanup.failures > 0) {
		parts.push(`failed ${cleanup.failures}`);
	}

	return [` cleanup       ${parts.join(' · ')}`];
};

interface Params {
	progress: RunProgress;
}

/**
 * A going run with no live process behind it can no longer move, so its running
 * row is drawn stopped and one line names the command that picks it back up —
 * drawing it running would make a crashed run look busy.
 */
export const renderRunProgress = ({ progress }: Params): string[] => {
	const stopped = (progress.status === RunStatus.Running || progress.status === RunStatus.Pending) && !progress.live;
	const rows = stopped ? progress.rows.map((row) => (row.status === RunStatus.Running ? { ...row, stopped: true } : row)) : progress.rows;
	const stoppedLines = stopped ? [` no live process — resume with ${progress.resumeCommand}`] : [];
	const diagnostics = [...stoppedLines, ...progress.rows.flatMap((row) => [...verificationLines({ row }), ...cleanupLines({ row })])];
	const cost = progress.costUsd === undefined ? '' : ` · ${formatCost({ usd: progress.costUsd })}`;
	const totals = `elapsed ${formatClockDuration({ ms: progress.elapsedMs })} · ${progress.changedFileCount} files${cost}`;

	return renderProgressBlock({ title: progress.title, tag: progress.shortId, rows, diagnostics, totals, now: progress.now });
};
