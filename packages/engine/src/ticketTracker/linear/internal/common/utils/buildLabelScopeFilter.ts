import type { LinearClient } from '@linear/sdk';

/** Derived from the client method because `@linear/sdk` does not export `IssueLabelFilter` from its entry point. */
type LabelFilterClause = NonNullable<NonNullable<NonNullable<Parameters<LinearClient['issueLabels']>[0]>['filter']>['or']>[number];

interface Params {
	/** The team key, e.g. 'LO'. */
	team: string;
}

/** A workspace-level label has no team, so filtering on the team key alone would report it missing. */
export const buildLabelScopeFilter = ({ team }: Params): LabelFilterClause[] => [{ team: { key: { eq: team } } }, { team: { null: true } }];
