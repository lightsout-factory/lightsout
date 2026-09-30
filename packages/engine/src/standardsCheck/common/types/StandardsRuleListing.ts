import type { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';

export interface StandardsRuleListing {
	/** The full rule name `<library>/<rule-id>` — the one a finding carries. */
	rule: string;
	/** '<library name>: <topic folder>' — which library states the rule, and where in it. */
	doc: string;
	summary: string;
	/** True when the rule ships a check code runs; false when it is judgment an agent has to read. */
	checked: boolean;
	severity: StandardsSeverity;
	/** True when this repo's config set the severity or the options. */
	fromConfig: boolean;
	options: Record<string, number>;
}
