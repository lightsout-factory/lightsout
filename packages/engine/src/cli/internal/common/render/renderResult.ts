import { basename } from 'node:path';
import { formatCost, formatDuration, formatShortRunId, formatTokenCount } from '@lightsout/shared';
import { renderStepTable } from '#src/cli/internal/common/render/renderStepTable.ts';
import { bold } from '#src/cli/internal/common/terminal/bold.ts';
import { paintStatus } from '#src/cli/internal/common/terminal/paintStatus.ts';
import { plural } from '#src/cli/internal/common/utils/plural.ts';
import type { CleanupSummary } from '#src/common/types/CleanupSummary.ts';
import type { RunSummary } from '#src/common/types/RunSummary.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import type { PipelineResult } from '#src/pipeline/PipelineResult.ts';
import { summarizeRun } from '#src/runState/summarizeRun/summarizeRun.ts';

const label = ({ name, value }: { name: string; value: string }) => `${name.padEnd(10)}${value}`;

const describeGates = ({ gates }: { gates: RunSummary['gates'] }) => {
	const parts = [`${gates.commands} command${plural({ count: gates.commands })}`];

	if (gates.reruns > 0) {
		parts.push(`${gates.reruns} flake re-run${plural({ count: gates.reruns })}`);
	}

	if (gates.skipped > 0) {
		parts.push(`${gates.skipped} skipped (no script)`);
	}

	return parts.join(' · ');
};

/** A count is named only when there is one: four zeroes say less than the two facts that are always true. */
const describeCleanup = ({ cleanup }: { cleanup: CleanupSummary }) => {
	const parts = [`${cleanup.rounds} round${plural({ count: cleanup.rounds })}`, cleanup.endReason ?? 'in progress'];

	if (cleanup.remainingFindings > 0) {
		parts.push(`${cleanup.remainingFindings} remaining`);
	}

	if (cleanup.carriedFindings > 0) {
		parts.push(`${cleanup.carriedFindings} carried forward`);
	}

	if (cleanup.failures > 0) {
		parts.push(`${cleanup.failures} failed attempt${plural({ count: cleanup.failures })}`);
	}

	return parts.join(' · ');
};

/**
 * A passing run that added no commit had its unit's commit land on an earlier
 * attempt, so it says so rather than leaving a reader to run `git status`.
 */
const describeCommits = ({ manifest, ok }: { manifest: RunManifest; ok: boolean }) => {
	if (manifest.commits.length > 0) {
		return manifest.commits.map((commit) => `${commit.sha.slice(0, 7)} ${commit.subject}`).join(' · ');
	}

	return ok && manifest.changedFiles.length > 0 ? 'none added — this run’s work was already in the branch’s history' : undefined;
};

/**
 * A run follows the config it read at its start, so a run that edited the
 * root config says the edit was not in force, rather than implying it was.
 */
const describeConfigChange = ({ manifest }: { manifest: RunManifest }) =>
	manifest.configPath !== undefined && manifest.changedFiles.includes('lightsout.config.json')
		? `lightsout.config.json changed during this run; this run kept the configuration it started with, from ${manifest.configPath}. Runs pick up the edit once it is in the checkout they start from.`
		: undefined;

interface Params {
	result: PipelineResult;
	cwd: string;
}

// The card's head: which run, and what it cost in time and tokens.
const renderCostLines = ({ manifest, summary }: { manifest: RunManifest; summary: RunSummary }) => {
	const lines = [
		label({
			name: 'run',
			value: `${formatShortRunId({ runId: manifest.runId })} · ${paintStatus({ status: manifest.status, text: bold(manifest.status.toUpperCase()) })}`,
		}),
		label({ name: 'plan', value: basename(manifest.plan) }),
		label({ name: 'wall', value: formatDuration({ ms: summary.wallMs }) }),
	];

	if (summary.activeMs > 0) {
		lines.push(label({ name: 'active', value: formatDuration({ ms: summary.activeMs }) }));
	}

	lines.push(label({ name: 'gates', value: formatDuration({ ms: summary.gateMs }) }));

	if (summary.usage && summary.usage.invocations > 0) {
		const { invocations, inputTokens, outputTokens, cacheReadTokens, costUsd } = summary.usage;
		const share = summary.cacheReadShare === undefined ? '' : ` (${Math.round(summary.cacheReadShare * 100)}%)`;

		lines.push(
			label({
				name: 'tokens',
				value: `in ${formatTokenCount({ count: inputTokens })} · out ${formatTokenCount({ count: outputTokens })} · cache-read ${formatTokenCount({ count: cacheReadTokens })}${share}`,
			}),
			label({ name: 'cost', value: `${formatCost({ usd: costUsd })} API-equivalent · ${invocations} invocation${plural({ count: invocations })}` }),
		);
	}

	return lines;
};

// The card's tail: how the gates, retries and cleanup went, and where the evidence is.
const renderDetailLines = ({ manifest, summary, ok }: { manifest: RunManifest; summary: RunSummary; ok: boolean }) => {
	const lines = [label({ name: 'gates', value: describeGates({ gates: summary.gates }) })];

	if (summary.rejectedReports > 0) {
		lines.push(label({ name: 'retries', value: `${summary.rejectedReports} rejected report${plural({ count: summary.rejectedReports })} re-emitted` }));
	}

	if (summary.cleanup) {
		lines.push(label({ name: 'cleanup', value: describeCleanup({ cleanup: summary.cleanup }) }));
	}

	if (summary.frictionByArea.length > 0) {
		const total = summary.frictionByArea.reduce((count, entry) => count + entry.count, 0);

		lines.push(label({ name: 'friction', value: `${total} · ${summary.frictionByArea.map((entry) => `${entry.area} ${entry.count}`).join(' · ')}` }));
	}

	if (manifest.packages.length > 0) {
		lines.push(label({ name: 'scope', value: `${manifest.packages.join(' · ')}${manifest.packagesSource ? ` (${manifest.packagesSource})` : ''}` }));
	}

	const commits = describeCommits({ manifest, ok });

	if (commits !== undefined) {
		lines.push(label({ name: 'commit', value: commits }));
	}

	if (manifest.unreachableChangedFiles.length > 0) {
		lines.push(
			label({
				name: 'warning',
				value: `unreachable-changed-files: ${manifest.unreachableChangedFiles.join(', ')} — changed, but no public surface reaches them; no tests cover them`,
			}),
		);
	}

	const configChange = describeConfigChange({ manifest });

	if (configChange !== undefined) {
		lines.push(label({ name: 'config', value: configChange }));
	}

	lines.push(label({ name: 'evidence', value: `.lightsout/runs/${manifest.runId}/` }));

	return lines;
};

/** The run's error is not part of the card: the caller prints it to the stream it belongs on, and saves it with these lines. */
export const renderResult = async ({ result, cwd }: Params): Promise<string[]> => {
	const { manifest, ok } = result;
	const summary = await summarizeRun({ cwd, manifest });

	return [
		'',
		...renderCostLines({ manifest, summary }),
		'',
		...renderStepTable({ steps: summary.steps, activeMs: summary.activeMs }),
		'',
		...renderDetailLines({ manifest, summary, ok }),
	];
};
