import { readOptionalConfig } from '#src/common/config/readOptionalConfig.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import type { StandardsRuleView } from '#src/contracts/views/StandardsRuleView.ts';
import type { StandardsView } from '#src/contracts/views/StandardsView.ts';
import { resolveStandardsGroups } from '#src/standards/resolveStandardsGroups.ts';
import { buildStandardsHealth } from '#src/standardsCheck/buildStandardsHealth.ts';
import type { StandardsHealthRule } from '#src/standardsCheck/common/types/StandardsHealthRule.ts';
import type { StandardsRuleListing } from '#src/standardsCheck/common/types/StandardsRuleListing.ts';
import { listStandardsRules } from '#src/standardsCheck/listStandardsRules.ts';
import { listStandardsSnapshots } from '#src/standardsCheck/listStandardsSnapshots.ts';
import { readStandardsSnapshot } from '#src/standardsCheck/readStandardsSnapshot.ts';
import type { LoadedStandardsRule } from '#src/standardsLibraries/common/types/LoadedStandardsRule.ts';
import { mapPackRules } from '#src/standardsLibraries/mapPackRules.ts';

const countByRule = ({ findings }: { findings: StandardsFinding[] }) => {
	const counts = new Map<string, number>();

	for (const finding of findings) {
		counts.set(finding.rule, (counts.get(finding.rule) ?? 0) + 1);
	}

	return counts;
};

const buildRuleView = ({
	listing,
	rule,
	health,
	findingCount,
}: {
	listing: StandardsRuleListing;
	rule: LoadedStandardsRule;
	health: StandardsHealthRule;
	findingCount: number;
}): StandardsRuleView => {
	return {
		rule: listing.rule,
		doc: listing.doc,
		documentPath: rule.documentPath,
		set: rule.set,
		summary: listing.summary,
		prose: rule.prose,
		checked: listing.checked,
		reviewed: listing.reviewed,
		severity: listing.severity,
		fromConfig: listing.fromConfig,
		options: listing.options,
		findingCount,
		history: {
			attempted: health.attempted,
			resolved: health.resolved,
			declined: health.declined,
			untracked: health.untracked,
			adviceApplied: health.adviceApplied,
			adviceDeclined: health.adviceDeclined,
			adviceAlreadyMet: health.adviceAlreadyMet,
			reasons: health.reasons,
		},
	};
};

interface Params {
	cwd: string;
}

/**
 * Every rule in the selected pack gets a row even with no open findings,
 * because the view answers "what does this repo enforce?"; a repo with no
 * snapshot yet is normal.
 *
 * @throws {Error} When the standards pack cannot be loaded, or the config names a rule the pack does not hold.
 */
export const getStandardsView = async ({ cwd }: Params): Promise<StandardsView> => {
	const config = await readOptionalConfig({ cwd });
	const groups = await resolveStandardsGroups({ cwd, config });
	const listings = listStandardsRules({ groups });
	const health = await buildStandardsHealth({ cwd, groups });
	const snapshot = await readStandardsSnapshot({ cwd });
	const findings = snapshot?.findings ?? [];
	const loaded = mapPackRules({ packs: groups.map((group) => group.pack) });
	const counts = countByRule({ findings });
	const rules: StandardsRuleView[] = [];

	for (const listing of listings) {
		const rule = loaded.get(listing.rule);
		const ruleHealth = health.rules.find((entry) => entry.rule === listing.rule);

		// Findings, history and health are keyed by rule, so a rule the list splits
		// per package keeps its first listing — the widest package set — as its one
		// row. The other two tests skip nothing in practice; they keep a row from
		// being built out of half an answer.
		if (rule === undefined || ruleHealth === undefined || rules.some((row) => row.rule === listing.rule)) {
			continue;
		}

		rules.push(buildRuleView({ listing, rule, health: ruleHealth, findingCount: counts.get(listing.rule) ?? 0 }));
	}

	return {
		at: snapshot?.at,
		path: snapshot?.path ?? '.',
		notes: snapshot?.notes ?? [],
		findings,
		rules,
		trend: await listStandardsSnapshots({ cwd }),
		totals: {
			...health.totals,
			blocking: findings.filter((finding) => finding.severity === StandardsSeverity.Blocking).length,
			advisory: findings.filter((finding) => finding.severity === StandardsSeverity.Advisory).length,
			orphans: findings.filter((finding) => !loaded.has(finding.rule)).length,
		},
	};
};
