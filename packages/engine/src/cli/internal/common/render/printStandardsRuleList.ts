import { renderTable } from '#src/cli/internal/common/render/renderTable.ts';
import { bold } from '#src/cli/internal/common/terminal/bold.ts';
import { dim } from '#src/cli/internal/common/terminal/dim.ts';
import { describePackageSet } from '#src/common/workspace/describePackageSet.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import type { StandardsRuleListing } from '#src/standardsCheck/common/types/StandardsRuleListing.ts';

/** Distinct rule names: a rule graded differently per package has several listings but is one rule. */
const countRules = ({ rules, where }: { rules: StandardsRuleListing[]; where: (rule: StandardsRuleListing) => boolean }) =>
	new Set(rules.filter(where).map((rule) => rule.rule)).size;

/** Shown so a retuned knob is visible without opening the config. */
const describeOptions = ({ options }: { options: Record<string, number> }) =>
	Object.entries(options)
		.map(([name, value]) => `${name} ${value}`)
		.join(', ');

interface Params {
	rules: StandardsRuleListing[];
}

/**
 * A row the repo's config set is marked, because "this is our policy" and "this
 * is the default" are different answers. The checker column shows which rules
 * no code run will ever catch, so the ledger does not read as though every rule
 * were enforced. The applies-to column names the packages each row's state
 * holds in, and the totals count rules, not rows.
 */
export const printStandardsRuleList = ({ rules }: Params): void => {
	const rows = rules.flatMap((rule) => {
		const options = describeOptions({ options: rule.options });

		return [
			{
				cells: [
					rule.rule,
					rule.fromConfig ? `${rule.severity} (config)` : rule.severity,
					rule.checked ? 'code' : 'judgment',
					rule.doc,
					describePackageSet({ packages: rule.packages }),
				],
			},
			{
				cells: [options === '' ? rule.summary : `${rule.summary} — ${options}`, '', '', '', ''],
				ruleAbove: false,
				emphasis: dim,
			},
		];
	});
	const atSeverity = (severity: StandardsSeverity) => countRules({ rules, where: (rule) => rule.severity === severity });
	const checked = countRules({ rules, where: (rule) => rule.checked });
	const judged = countRules({ rules, where: (rule) => !rule.checked });
	const totals = {
		cells: [
			`${countRules({ rules, where: () => true })} rule(s)`,
			`${atSeverity(StandardsSeverity.Blocking)} blocking`,
			`${atSeverity(StandardsSeverity.Advisory)} advisory, ${atSeverity(StandardsSeverity.Off)} off`,
			`${checked} by code, ${judged} by judgment`,
			'',
		],
		emphasis: bold,
	};

	for (const line of renderTable({ headers: ['rule', 'state', 'checked by', 'standards doc', 'applies to'], rows: [...rows, totals] })) {
		console.log(line);
	}
};
