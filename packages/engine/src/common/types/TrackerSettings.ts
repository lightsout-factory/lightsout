interface BaseTrackerSettings {
	/** The human-reference prefix, e.g. `LO` in `LO-54`. */
	ticketPrefix: string;
	/** The key itself, read from the configured environment variable. Never logged. */
	apiKey: string;
}

export interface LinearTrackerSettings extends BaseTrackerSettings {
	provider: 'linear';
	team: string;
}

export interface JiraTrackerSettings extends BaseTrackerSettings {
	provider: 'jira';
	/** The configured Jira Cloud origin, normalized without a trailing slash. */
	siteUrl: string;
	project: string;
	/** Account email paired with the API token for Basic authentication. */
	apiUserEmail: string;
}

export type TrackerSettings = LinearTrackerSettings | JiraTrackerSettings;
