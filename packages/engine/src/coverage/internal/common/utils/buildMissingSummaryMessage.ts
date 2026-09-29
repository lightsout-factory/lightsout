interface Params {
	summaryPath: string;
	/** Scope whose coverage command just ran ('root' or a package dir). */
	scope: string;
}

/** Shared by every reader of a coverage summary so the guidance, which points at the fixes `lightsout doctor` validates, never drifts. */
export const buildMissingSummaryMessage = ({ summaryPath, scope }: Params): string =>
	`no readable coverage summary at ${summaryPath} after the ${scope} coverage command ran — configure a json-summary coverage reporter (jest: coverageReporters ['json-summary']) writing that path, or set coverage-summary-path in lightsout.config.json. \`lightsout doctor\` checks this.`;
