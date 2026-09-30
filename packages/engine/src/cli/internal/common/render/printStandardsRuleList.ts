import { renderTable } from '#src/cli/internal/common/render/renderTable.ts';
import { bold } from '#src/cli/internal/common/terminal/bold.ts';
import { dim } from '#src/cli/internal/common/terminal/dim.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import type { StandardsRuleListing } from '#src/standardsCheck/common/types/StandardsRuleListing.ts';

const countOf = ({ rules, severity }: { rules: StandardsRuleListing[]; severity: StandardsSeverity }) =>
	rules.filter((rule) => rule.severity === severity).length;

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
 * were enforced.
 */
export const printStandardsRuleList = ({ rules }: Params): void => {
	const rows = rules.flatMap((rule) => {
		const options = describeOptions({ options: rule.options });

		return [
			{
				cells: [rule.rule, rule.fromConfig ? `${rule.severity} (config)` : rule.severity, rule.checked ? 'code' : 'judgment', rule.doc],
			},
			{
				cells: [options === '' ? rule.summary : `${rule.summary} — ${options}`, '', '', ''],
				ruleAbove: false,
				emphasis: dim,
			},
		];
	});
	const checked = rules.filter((rule) => rule.checked).length;
	const totals = {
		cells: [
			`${rules.length} rule(s)`,
			`${countOf({ rules, severity: StandardsSeverity.Blocking })} blocking`,
			`${countOf({ rules, severity: StandardsSeverity.Advisory })} advisory, ${countOf({ rules, severity: StandardsSeverity.Off })} off`,
			`${checked} by code, ${rules.length - checked} by judgment`,
		],
		emphasis: bold,
	};

	for (const line of renderTable({ headers: ['rule', 'state', 'checked by', 'standards doc'], rows: [...rows, totals] })) {
		console.log(line);
	}
};
