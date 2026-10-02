import { formatDuration } from '@lightsout/shared';
import { buildStandardsReviewInvocation } from '#src/agents/buildStandardsReviewInvocation.ts';
import { collectGroupItems } from '#src/common/utils/collectGroupItems.ts';
import { describePackageSet } from '#src/common/workspace/describePackageSet.ts';
import { listWorkspacePackages } from '#src/common/workspace/listWorkspacePackages.ts';
import { Permissions } from '#src/contracts/Permissions.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { StandardsReviewReport } from '#src/contracts/standardsCheck/StandardsReviewReport.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import { invokeAgentWithContract } from '#src/invoke/invokeAgentWithContract.ts';
import type { StandardsGroup } from '#src/standards/common/types/StandardsGroup.ts';
import { createAgentHeartbeat } from '#src/standardsCheck/internal/common/utils/createAgentHeartbeat.ts';
import { findFileStandardsGroup } from '#src/standardsCheck/internal/common/utils/findFileStandardsGroup.ts';
import type { LoadedStandardsRule } from '#src/standardsLibraries/common/types/LoadedStandardsRule.ts';
import { resolveRuleName } from '#src/standardsLibraries/resolveRuleName.ts';

interface Params {
	cwd: string;
	driver: Driver;
	groups: StandardsGroup[];
	/** Files in scope — changed files at the gate, batch files in refactor, the path scope in the CLI. */
	files: string[];
	/** Monorepo package parent dir (config['packages-dir'] ?? defaultPackagesDir), so each finding is graded by its file's group. */
	packagesDir: string;
	timeoutMs?: number;
	onProgress?: (message: string) => void;
}

interface JudgmentRule {
	rule: LoadedStandardsRule;
	/** The packages of every group running the rule at a reporting severity. */
	packages: Set<string>;
}

/** True when the group holding the file runs the rule at a reporting severity. */
const runsRule = ({ group, name }: { group: StandardsGroup; name: string }) => {
	const severity = group.states.get(name)?.severity;

	return severity !== undefined && severity !== StandardsSeverity.Off;
};

/** A judgment rule several groups hold is reviewed once, by full name, with the packages it applies to. */
const collectJudgmentRules = ({ groups }: { groups: StandardsGroup[] }) =>
	[
		...collectGroupItems({
			groups,
			itemsOf: ({ group }) => group.pack.rules.map(({ rule }) => rule).filter((rule) => rule.reviewed && runsRule({ group, name: rule.name })),
			keyOf: ({ item }) => item.name,
		}).values(),
	].map(({ item, packages }) => ({ rule: item, packages }));

/** Only a rule that does not apply to every package the groups cover is scoped for the reviewer. */
const toReviewRules = ({ judgmentRules, groups }: { judgmentRules: JudgmentRule[]; groups: StandardsGroup[] }) => {
	const covered = new Set(groups.flatMap((group) => group.packages));

	return judgmentRules.map(({ rule, packages }) =>
		packages.size === covered.size ? rule : { ...rule, appliesTo: describePackageSet({ packages: [...packages] }) },
	);
};

const dropNotes = ({ unknownRules, unsited, ungrouped, notRun }: { unknownRules: string[]; unsited: number; ungrouped: number; notRun: string[] }) => {
	const notes: string[] = [];

	if (unknownRules.length > 0) {
		notes.push(`agent review: ${unknownRules.length} finding(s) dropped — no judgment rule is named ${[...new Set(unknownRules)].sort().join(', ')}`);
	}

	if (unsited > 0) {
		notes.push(`agent review: ${unsited} finding(s) dropped — reported with no file to point at`);
	}

	if (ungrouped > 0) {
		notes.push(`agent review: ${ungrouped} finding(s) dropped — no standards group covers the file's package`);
	}

	if (notRun.length > 0) {
		notes.push(`agent review: ${notRun.length} finding(s) dropped — the file's package does not run ${[...new Set(notRun)].sort().join(', ')}`);
	}

	return notes;
};

/**
 * Everything dropped is counted and stated — a silent drop would read as a
 * clean review. The agent may write a rule's full name or a short id only one
 * rule in scope holds; either way the finding carries the full name. A finding
 * stands only where the group holding its file runs the rule.
 */
const toFindings = ({
	reported,
	rules,
	groupOfFile,
}: {
	reported: StandardsReviewReport['findings'];
	rules: LoadedStandardsRule[];
	groupOfFile: (file: string) => StandardsGroup | undefined;
}) => {
	const findings: StandardsFinding[] = [];
	const unknownRules: string[] = [];
	const notRun: string[] = [];
	let unsited = 0;
	let ungrouped = 0;

	for (const entry of reported) {
		const path = entry.files[0]?.path;
		const resolved = resolveRuleName({ name: entry.rule, rules });

		if ('problem' in resolved) {
			unknownRules.push(entry.rule);
			continue;
		}

		if (path === undefined) {
			unsited += 1;
			continue;
		}

		const group = groupOfFile(path);

		if (group === undefined) {
			ungrouped += 1;
			continue;
		}

		if (!runsRule({ group, name: resolved.rule.name })) {
			notRun.push(resolved.rule.name);
			continue;
		}

		findings.push({
			rule: resolved.rule.name,
			severity: StandardsSeverity.Advisory,
			siteKey: `${resolved.rule.name}:${path}`,
			files: entry.files,
			detail: entry.detail,
			...(entry.guidance === undefined ? {} : { guidance: entry.guidance }),
		});
	}

	return { findings, notes: dropNotes({ unknownRules, unsited, ungrouped, notRun }) };
};

/**
 * Its findings are always advisory and never gate, because a judgment call is
 * not evidence.
 *
 * Nothing here throws: every failure comes back as a skipped review with a
 * plain note, because the machine half is real evidence and must still be
 * reported, and a repo whose harness is absent is not a repo in violation.
 *
 * Site keys are derived here rather than asked for, and a finding naming a rule
 * no single loaded judgment rule answers to is dropped — a name an agent
 * invented must not be able to enter the findings stream.
 */
export const runStandardsReview = async ({
	cwd,
	driver,
	groups,
	files,
	packagesDir,
	timeoutMs,
	onProgress,
}: Params): Promise<{ findings: StandardsFinding[]; notes: string[] }> => {
	const judgmentRules = collectJudgmentRules({ groups });
	const rules = judgmentRules.map(({ rule }) => rule);

	// Nothing to read, or nothing to read it against: no agent is spent saying so.
	if (rules.length === 0 || files.length === 0) {
		return { findings: [], notes: [] };
	}

	// Every progress line names the review, so it stands on its own in a
	// pipeline log as much as under the command's own heading.
	const ruleCount = `${rules.length} rule${rules.length === 1 ? '' : 's'}`;

	onProgress?.(
		`The agent review is now running. ${driver.name} is reading your code against the ${ruleCount} that take judgment. This usually takes a few minutes.`,
	);

	const heartbeat = createAgentHeartbeat({ label: 'agent review', onProgress: (message) => onProgress?.(message) });

	// Stopped in `finally` so a throwing invocation never leaves a ticker behind.
	const outcome = await invokeAgentWithContract({
		driver,
		cwd,
		invocation: buildStandardsReviewInvocation({ rules: toReviewRules({ judgmentRules, groups }), files }),
		contract: StandardsReviewReport,
		permissions: Permissions.ReadOnly,
		timeoutMs,
		onEvent: heartbeat.onEvent,
	}).finally(() => heartbeat.stop());

	const elapsed = formatDuration({ ms: heartbeat.elapsedMs() });

	if (!outcome.ok) {
		onProgress?.(`Agent review stopped after ${elapsed}.`);

		return { findings: [], notes: [`agent review skipped — ${outcome.failure}`] };
	}

	const workspacePackages = await listWorkspacePackages({ cwd, packagesDir });
	const result = toFindings({
		reported: outcome.report.findings,
		rules,
		groupOfFile: (file) => findFileStandardsGroup({ file, groups, packagesDir, workspacePackages }),
	});
	const count = result.findings.length;
	const found = count === 0 ? 'nothing to report' : `${count} advisor${count === 1 ? 'y' : 'ies'} to look at`;

	onProgress?.(`✓ Agent review finished in ${elapsed} — ${found}`);

	return result;
};
