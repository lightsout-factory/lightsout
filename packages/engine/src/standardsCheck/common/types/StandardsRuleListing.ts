import type { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';

export interface StandardsRuleListing {
	/** The full rule name `<library>/<rule-id>` — the one a finding carries. */
	rule: string;
	/** '<library name>: <topic folder>' — which library states the rule, and where in it. */
	doc: string;
	summary: string;
	/** True when the rule ships a check code runs. */
	checked: boolean;
	/** True when an agent reviews the rule: it ships no check, or its check covers only part of it. */
	reviewed: boolean;
	severity: StandardsSeverity;
	/** True when this repo's config set the severity or the options. */
	fromConfig: boolean;
	options: Record<string, number>;
	/** The package folder names this row's state applies to; '' is the repo root group. */
	packages: string[];
}
