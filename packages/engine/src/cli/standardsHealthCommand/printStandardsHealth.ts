import { describeCheckKinds } from '#src/cli/common/describeCheckKinds.ts';
import { renderTable } from '#src/cli/common/render/renderTable.ts';
import { bold } from '#src/cli/common/terminal/bold.ts';
import { dim } from '#src/cli/common/terminal/dim.ts';
import type { StandardsHealth } from '#src/common/types/StandardsHealth.ts';
import type { StandardsHealthRule } from '#src/common/types/StandardsHealthRule.ts';

/** One long rationale must not stretch the whole table. */
const reasonWidth = 96;

const count = ({ value }: { value: number }) => (value === 0 ? '—' : `${value}`);

/** '—' when nothing was ever put to the test: an unasked question has no answer, and 0% would read as one. */
const rate = ({ part, total }: { part: number; total: number }) => (total === 0 ? '—' : `${Math.round((part / total) * 100)}%`);

/** Deduplicated because the same rationale repeats across a rule's batches. */
const reasonLines = ({ reasons }: { reasons: string[] }) =>
	[...new Set(reasons.map((reason) => reason.replace(/\s+/g, ' ').trim()))]
		.filter((reason) => reason.length > 0)
		.map((reason) => (reason.length > reasonWidth ? `${reason.slice(0, reasonWidth - 1)}…` : reason));

/**
 * `already-met` advice is kept out of the decline rate's denominator, or a rule
 * whose advice is usually redundant would show a falling decline rate for a
 * reason that has nothing to do with declining.
 */
const answerableAdvice = ({ rule }: { rule: StandardsHealthRule }) => rule.adviceApplied + rule.adviceDeclined;

const ruleRows = ({ rule }: { rule: StandardsHealthRule }) => {
	const advice = answerableAdvice({ rule }) + rule.adviceAlreadyMet;

	return [
		{
			cells: [
				rule.rule,
				describeCheckKinds({ rule }),
				count({ value: rule.attempted }),
				count({ value: rule.resolved }),
				count({ value: rule.declined }),
				count({ value: rule.untracked }),
				rate({ part: rule.declined, total: rule.attempted }),
				count({ value: advice }),
				rate({ part: rule.adviceDeclined, total: answerableAdvice({ rule }) }),
			],
		},
		...reasonLines({ reasons: rule.reasons }).map((reason) => ({
			cells: [`· ${reason}`, '', '', '', '', '', '', '', ''],
			ruleAbove: false,
			emphasis: dim,
		})),
	];
};

const sum = ({ rules, of }: { rules: StandardsHealthRule[]; of: (rule: StandardsHealthRule) => number }) => rules.reduce((total, rule) => total + of(rule), 0);

interface Params {
	health: StandardsHealth;
}

/**
 * `sites` and the three columns after it are measured (re-checked on disk after
 * a refactor run), while `advice` is only the agent's own answer; they are never
 * added together, or the measured half would vouch for the reported half.
 *
 * `untracked` sites had no recorded fate (a failed, parked or unrun batch), and
 * counting them as declines would blame a rule for an outage.
 */
export const printStandardsHealth = ({ health }: Params): void => {
	const { rules, totals } = health;
	const rows = rules.flatMap((rule) => ruleRows({ rule }));
	const attempted = sum({ rules, of: (rule) => rule.attempted });
	const advice = sum({ rules, of: (rule) => answerableAdvice({ rule }) + rule.adviceAlreadyMet });
	const totalsRow = {
		cells: [
			`${totals.rules} rule(s)`,
			`${totals.deterministic} deterministic, ${totals.agent} agent`,
			count({ value: attempted }),
			count({ value: sum({ rules, of: (rule) => rule.resolved }) }),
			count({ value: sum({ rules, of: (rule) => rule.declined }) }),
			count({ value: sum({ rules, of: (rule) => rule.untracked }) }),
			rate({ part: sum({ rules, of: (rule) => rule.declined }), total: attempted }),
			count({ value: advice }),
			rate({ part: sum({ rules, of: (rule) => rule.adviceDeclined }), total: sum({ rules, of: (rule) => answerableAdvice({ rule }) }) }),
		],
		emphasis: bold,
	};

	for (const line of renderTable({
		headers: ['rule', 'check', 'sites', 'resolved', 'declined', 'untracked', 'declined %', 'advice', 'advice declined %'],
		rows: [...rows, totalsRow],
	})) {
		console.log(line);
	}

	console.log('');
	console.log(dim('sites: blocking findings a refactor run worked and re-checked. advice: advisory and agent-review findings, as the agent reported them.'));
};
