import { formatDuration } from '@lightsout/shared';
import { getStringFlag } from '#src/cli/common/args/getStringFlag.ts';
import type { CommandContext } from '#src/cli/common/types/CommandContext.ts';
import { exitCli } from '#src/cli/common/utils/exitCli.ts';
import { printFindingGroups } from '#src/cli/internal/common/render/printFindingGroups.ts';
import { printSectionHeading } from '#src/cli/internal/common/render/printSectionHeading.ts';
import { printStandardsRuleList } from '#src/cli/internal/common/render/printStandardsRuleList.ts';
import { printStandardsSummary } from '#src/cli/internal/common/render/printStandardsSummary.ts';
import { dim } from '#src/cli/internal/common/terminal/dim.ts';
import { readStandardsLedger } from '#src/cli/readStandardsLedger.ts';
import { reviewStandards } from '#src/cli/reviewStandards.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { runStandardsCheck } from '#src/standardsCheck/runStandardsCheck/runStandardsCheck.ts';
import { writeStandardsSnapshot } from '#src/standardsCheck/writeStandardsSnapshot.ts';

const printProgress = (message: string) => console.log(dim(`  ${message}`));

// Blocking first, so an advisory read first does not set the wrong expectation.
const orderBySeverity = ({ findings }: { findings: StandardsFinding[] }) => [
	...findings.filter((entry) => entry.severity === StandardsSeverity.Blocking),
	...findings.filter((entry) => entry.severity === StandardsSeverity.Advisory),
];

const describeDeterministicFindings = ({ findings }: { findings: StandardsFinding[] }) => {
	const blocking = findings.filter((entry) => entry.severity === StandardsSeverity.Blocking).length;
	const advisories = findings.length - blocking;

	if (findings.length === 0) {
		return 'nothing found';
	}

	return [blocking > 0 ? `${blocking} blocking` : '', advisories > 0 ? `${advisories} advisor${advisories === 1 ? 'y' : 'ies'}` : '']
		.filter(Boolean)
		.join(', ');
};

// Printed the moment each half finishes, so a reader waiting on the slow half
// already has the fast half's answer.
const printSectionResult = ({ findings, notes }: { findings: StandardsFinding[]; notes: string[] }) => {
	// The group renderer opens each rule with its own blank line.
	if (findings.length > 0) {
		printFindingGroups({ findings });
	}

	if (notes.length > 0) {
		console.log('');
	}

	for (const note of notes) {
		console.log(`  ${dim('ℹ')} ${dim(note)}`);
	}
};

export const standardsCheckCommand = async ({ flags, cwd }: CommandContext): Promise<void> => {
	const { config, rules } = await readStandardsLedger({ cwd });

	if (flags.get('list') === true) {
		printStandardsRuleList({ rules });
		return exitCli({ code: 0 });
	}

	const deterministicOnly = flags.get('deterministic-checks') === true;
	const agentReviewOnly = flags.get('agent-review') === true;
	const runDeterministicChecks = deterministicOnly || !agentReviewOnly;
	const runAgentReview = agentReviewOnly || !deterministicOnly;

	const checkPath = getStringFlag({ flags, name: 'path' });
	const findings: StandardsFinding[] = [];
	const notes: string[] = [];

	if (runDeterministicChecks) {
		printSectionHeading({ title: 'Deterministic checks', subtitle: 'code decides, with the same answer every run' });

		const startedAt = Date.now();
		// Persistence is this command's job, not the check's: the merged stream is
		// what the reader was shown, and two writers to one file would race.
		const checked = await runStandardsCheck({
			cwd,
			config,
			path: checkPath,
			all: flags.get('all') === true,
			writeBaseline: flags.get('baseline') === true,
			persist: false,
			onProgress: printProgress,
		});
		const ordered = orderBySeverity({ findings: checked.findings });

		printProgress(
			`✓ Deterministic checks finished in ${formatDuration({ ms: Date.now() - startedAt })} — ${describeDeterministicFindings({ findings: ordered })}`,
		);
		printSectionResult({ findings: ordered, notes: checked.notes });
		findings.push(...ordered);
		notes.push(...checked.notes);
	}

	if (runAgentReview) {
		// The review narrates itself — started, still running, finished — so the
		// heading is all the command adds.
		printSectionHeading({ title: 'Agent review' });

		const reviewed = await reviewStandards({ cwd, config, path: checkPath, onProgress: printProgress });

		printSectionResult({ findings: reviewed.findings, notes: reviewed.notes });
		findings.push(...reviewed.findings);
		notes.push(...reviewed.notes);
	}

	// The evidence file is the deterministic checks' work-list, so a review-only run leaves
	// it as the last real check left it.
	if (runDeterministicChecks) {
		await writeStandardsSnapshot({ cwd, snapshot: { at: new Date().toISOString(), path: checkPath ?? '.', findings, notes } });
	}

	printStandardsSummary({ findings, rules, reportPath: runDeterministicChecks ? '.lightsout/standards-check.json' : undefined });
	return exitCli({ code: 0 });
};
