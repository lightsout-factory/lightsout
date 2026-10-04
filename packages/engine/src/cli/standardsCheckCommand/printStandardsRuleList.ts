import { describeCheckKinds } from '#src/cli/common/describeCheckKinds.ts';
import { renderTable } from '#src/cli/common/render/renderTable.ts';
import { bold } from '#src/cli/common/terminal/bold.ts';
import { dim } from '#src/cli/common/terminal/dim.ts';
import type { StandardsRuleListing } from '#src/common/types/StandardsRuleListing.ts';
import { describePackageSet } from '#src/common/workspace/describePackageSet.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';

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
 * is the default" are different answers. The check column shows which rules
 * no deterministic check will ever catch, so the ledger does not read as though
 * every rule were enforced. The applies-to column names the packages each row's state
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
					describeCheckKinds({ rule }),
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
	const deterministic = countRules({ rules, where: (rule) => rule.deterministic });
	const agent = countRules({ rules, where: (rule) => rule.agent });
	const totals = {
		cells: [
			`${countRules({ rules, where: () => true })} rule(s)`,
			`${atSeverity(StandardsSeverity.Blocking)} blocking`,
			`${atSeverity(StandardsSeverity.Advisory)} advisory, ${atSeverity(StandardsSeverity.Off)} off`,
			`${deterministic} deterministic, ${agent} agent`,
			'',
		],
		emphasis: bold,
	};

	for (const line of renderTable({ headers: ['rule', 'state', 'check', 'standards doc', 'applies to'], rows: [...rows, totals] })) {
		console.log(line);
	}
};
