import type { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';

export interface StandardsRuleListing {
	/** The full rule name `<library>/<rule-id>` — the one a finding carries. */
	rule: string;
	/** '<library name>: <topic folder>' — which library states the rule, and where in it. */
	doc: string;
	summary: string;
	/** True when the rule has a deterministic check — code that decides, with the same answer every run. */
	deterministic: boolean;
	/** True when the rule has an agent check — an agent reviews the change against it, because it ships no deterministic check or that check decides only part of it. */
	agent: boolean;
	severity: StandardsSeverity;
	/** True when this repo's config set the severity or the options. */
	fromConfig: boolean;
	options: Record<string, number>;
	/** The package folder names this row's state applies to; '' is the repo root group. */
	packages: string[];
}
