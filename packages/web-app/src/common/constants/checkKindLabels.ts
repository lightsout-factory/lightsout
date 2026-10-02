import { CheckKind } from '#src/common/constants/CheckKind.ts';

export const checkKindLabels: Record<CheckKind, { label: string; short: string; plural: string; definition: string }> = {
	[CheckKind.Deterministic]: {
		label: 'Deterministic check',
		short: 'Deterministic',
		plural: 'deterministic checks',
		definition: 'Code decides, with the same answer every run.',
	},
	[CheckKind.Agent]: {
		label: 'Agent check',
		short: 'Agent',
		plural: 'agent checks',
		definition: 'An agent reviews the change against the rule.',
	},
	[CheckKind.Both]: {
		label: 'Deterministic and agent check',
		short: 'Both',
		plural: 'checks of both kinds',
		definition: 'Code decides part of the rule; an agent reviews the rest.',
	},
};
