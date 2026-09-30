import type { ConfigView } from '@lightsout/engine';
import { builtInStandardsLibraryName, StandardsSeverity } from '@lightsout/engine/contracts';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { Badge } from '#src/appUI/badges/Badge.tsx';
import { MetadataTag } from '#src/appUI/badges/MetadataTag.tsx';
import { DataTable } from '#src/appUI/DataTable.tsx';
import { EmptyState } from '#src/appUI/EmptyState.tsx';
import { FilterDropdown } from '#src/appUI/FilterDropdown.tsx';
import { severityBadgeVariants } from '#src/common/constants/severityBadgeVariants.ts';
import type { DataTableColumn } from '#src/common/types/DataTableColumn.ts';

type RuleState = ConfigView['ruleStates'][number];

/** The public pack pages bundle only the built-in library, so a rule from any other library is its full name as plain text. */
const RuleLink = ({ state }: { state: RuleState }) =>
	state.library === builtInStandardsLibraryName ? (
		<Link
			to="/standards-packs/$library/rules/$rule"
			params={{ library: state.library, rule: state.id }}
			className="font-mono text-sm hover:underline hover:underline-offset-2"
		>
			{state.rule}
		</Link>
	) : (
		<span className="font-mono text-sm">{state.rule}</span>
	);

const RuleOptions = ({ state }: { state: RuleState }) => {
	const entries = Object.entries(state.options);

	return entries.length === 0 ? (
		<span className="text-muted-foreground">—</span>
	) : (
		<span className="flex flex-wrap gap-1">
			{entries.map(([name, value]) => (
				<MetadataTag key={name}>
					{name} {value}
				</MetadataTag>
			))}
		</span>
	);
};

const columns: Array<DataTableColumn<RuleState>> = [
	{ key: 'rule', header: 'rule', sortValue: (state) => state.rule, render: (state) => <RuleLink state={state} /> },
	{
		key: 'severity',
		header: 'severity here',
		sortValue: (state) => state.severity,
		render: (state) => <Badge variant={severityBadgeVariants[state.severity]}>{state.severity}</Badge>,
	},
	{
		key: 'fromConfig',
		header: 'set by',
		render: (state) => <span className="text-muted-foreground">{state.fromConfig ? 'this repo' : 'the pack'}</span>,
	},
	{ key: 'options', header: 'options', render: (state) => <RuleOptions state={state} /> },
	{ key: 'appliesTo', header: 'applies to', render: (state) => <span className="text-muted-foreground">{state.appliesTo}</span> },
];

interface Props {
	ruleStates: ConfigView['ruleStates'];
}

/** The same table `lightsout standards-check --list` prints, from the same reader, so the two cannot disagree. */
export const RuleLedger = ({ ruleStates }: Props) => {
	const [severities, setSeverities] = useState<string[]>([]);
	const rows = severities.length === 0 ? ruleStates : ruleStates.filter((state) => severities.includes(state.severity));

	return (
		<div className="flex flex-col gap-2">
			<FilterDropdown
				label="severity"
				options={Object.values(StandardsSeverity).map((severity) => ({
					value: severity,
					label: severity,
					count: ruleStates.filter((state) => state.severity === severity).length,
				}))}
				selected={severities}
				onChange={setSeverities}
			/>
			<DataTable
				rows={rows}
				columns={columns}
				getRowKey={(state) => `${state.rule} ${state.appliesTo}`}
				empty={<EmptyState title="No rules match this severity." />}
			/>
		</div>
	);
};
