import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BatchOutcome } from '#src/contracts/refactor/BatchOutcome.ts';
import { BatchReport } from '#src/contracts/refactor/BatchReport.ts';
import { RefactorWorklist } from '#src/contracts/refactor/RefactorWorklist.ts';
import type { AdvisoryOutcome } from '#src/contracts/standardsCheck/AdvisoryOutcome.ts';
import { AdvisoryResponse } from '#src/contracts/standardsCheck/AdvisoryResponse.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { resolveRunDir } from '#src/runState/common/paths/resolveRunDir.ts';
import { listRunIds } from '#src/runState/listRunIds.ts';
import { readRunManifest } from '#src/runState/readRunManifest.ts';
import type { StandardsGroup } from '#src/standards/common/types/StandardsGroup.ts';
import type { StandardsHealth } from '#src/standardsCheck/common/types/StandardsHealth.ts';
import type { StandardsHealthRule } from '#src/standardsCheck/common/types/StandardsHealthRule.ts';
import { mapPackRules } from '#src/standardsLibraries/mapPackRules.ts';

type Tally = Omit<StandardsHealthRule, 'rule' | 'set' | 'documentPath' | 'checked'>;

const emptyTally = (): Tally => ({
	attempted: 0,
	resolved: 0,
	declined: 0,
	untracked: 0,
	adviceApplied: 0,
	adviceDeclined: 0,
	adviceAlreadyMet: 0,
	reasons: [],
});

const tallyFor = ({ tallies, rule }: { tallies: Map<string, Tally>; rule: string }) => {
	const existing = tallies.get(rule);

	if (existing) {
		return existing;
	}

	const created = emptyTally();

	tallies.set(rule, created);

	return created;
};

const readRefactorRun = async ({ cwd, runId }: { cwd: string; runId: string }) => {
	const manifest = await readRunManifest({ cwd, runId });

	if ((manifest.pipeline ?? 'implement') !== 'refactor') {
		return undefined;
	}

	// The run's own directory rather than the recorded path joined onto `cwd`:
	// run folders resolve against the primary checkout.
	const worklist = RefactorWorklist.parse(JSON.parse(await readFile(join(await resolveRunDir({ cwd, runId }), 'worklist.json'), 'utf8')));

	return { worklist, steps: manifest.steps };
};

/** A site of a batch with no parseable report is untracked, not declined: a batch that failed is not a batch that judged. */
const countBatchSites = ({ tallies, blocking, report }: { tallies: Map<string, Tally>; blocking: StandardsFinding[]; report?: BatchReport }) => {
	const remaining = report ? new Set(report.remainingSiteKeys) : undefined;
	const leftStanding = new Set<string>();

	for (const finding of blocking) {
		const tally = tallyFor({ tallies, rule: finding.rule });

		tally.attempted += 1;

		if (remaining === undefined) {
			tally.untracked += 1;
			continue;
		}

		if (!remaining.has(finding.siteKey)) {
			tally.resolved += 1;
			continue;
		}

		leftStanding.add(finding.rule);

		if (report?.outcome === BatchOutcome.Declined) {
			tally.declined += 1;
		} else {
			tally.untracked += 1;
		}
	}

	// The rationale is recorded per batch, not per site, so it attaches to every
	// rule that still had a site standing when the batch ended — reporting what
	// was recorded rather than inventing an attribution nobody wrote down.
	for (const rule of leftStanding) {
		tallyFor({ tallies, rule }).reasons.push(...(report?.rationale ?? []));
	}
};

/** The only record judgment-only rules ever get. */
const countAdvice = ({ tallies, outcomes }: { tallies: Map<string, Tally>; outcomes: AdvisoryOutcome[] }) => {
	for (const entry of outcomes) {
		const tally = tallyFor({ tallies, rule: entry.rule });

		if (entry.outcome === AdvisoryResponse.Applied) {
			tally.adviceApplied += 1;
			continue;
		}

		// Counted apart from both: nothing was done and nothing was rejected, so
		// folding it into either number would misreport how often the advice is
		// worth its noise.
		if (entry.outcome === AdvisoryResponse.AlreadyMet) {
			tally.adviceAlreadyMet += 1;
			continue;
		}

		tally.adviceDeclined += 1;

		if (entry.reason !== undefined) {
			tally.reasons.push(entry.reason);
		}
	}
};

interface Params {
	cwd: string;
	groups: StandardsGroup[];
}

/** A run whose manifest or work-list cannot be read is skipped in silence, so one corrupt run directory cannot take the whole account down. */
export const buildStandardsHealth = async ({ cwd, groups }: Params): Promise<StandardsHealth> => {
	const tallies = new Map<string, Tally>();

	for (const runId of await listRunIds({ cwd })) {
		const run = await readRefactorRun({ cwd, runId }).catch(() => undefined);

		if (run === undefined) {
			continue;
		}

		for (const batch of run.worklist.batches) {
			const parsed = BatchReport.safeParse(run.steps.find((step) => step.id === batch.id)?.report);
			const report = parsed.success ? parsed.data : undefined;

			countBatchSites({ tallies, blocking: batch.blocking, report });
			countAdvice({ tallies, outcomes: report?.advisoryOutcomes ?? [] });
		}
	}

	const rules: StandardsHealthRule[] = [...mapPackRules({ packs: groups.map((group) => group.pack) }).values()].map((rule) => ({
		rule: rule.name,
		set: rule.set,
		documentPath: rule.documentPath,
		checked: rule.checked,
		...(tallies.get(rule.name) ?? emptyTally()),
	}));

	rules.sort((first, second) => first.rule.localeCompare(second.rule));

	const checked = rules.filter((rule) => rule.checked).length;

	return { rules, totals: { rules: rules.length, checked, judgment: rules.length - checked } };
};
