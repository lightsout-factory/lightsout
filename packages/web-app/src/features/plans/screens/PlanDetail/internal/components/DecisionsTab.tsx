import type { PlanWorkspaceView } from '@lightsout/engine';
import type { DecisionRow } from '@lightsout/engine/contracts';
import { Badge } from '#src/appUI/badges/Badge.tsx';
import { DataTable } from '#src/appUI/DataTable.tsx';
import { BadgeVariant } from '#src/common/constants/BadgeVariant.ts';
import type { DataTableColumn } from '#src/common/types/DataTableColumn.ts';

/** Keyed on its own: two decisions may ask the same question. */
interface LoggedDecision {
	key: string;
	decision: DecisionRow;
}

const columns: Array<DataTableColumn<LoggedDecision>> = [
	{ key: 'source', header: 'source', render: ({ decision }) => <Badge>{decision.source}</Badge> },
	{
		key: 'question',
		header: 'question',
		className: 'max-w-md',
		render: ({ decision }) => (
			<span className="flex flex-col gap-1">
				<span className="leading-5">{decision.question}</span>
				{/* A choice nobody confirmed is the one thing a reader of this table has to be able to spot. */}
				{decision.assumption ? <Badge variant={BadgeVariant.Advisory}>assumption</Badge> : null}
			</span>
		),
	},
	{ key: 'options', header: 'options', className: 'max-w-xs', render: ({ decision }) => <span className="leading-5">{decision.options}</span> },
	{ key: 'choice', header: 'choice', className: 'max-w-xs', render: ({ decision }) => <span className="font-medium leading-5">{decision.choice}</span> },
	{ key: 'rationale', header: 'rationale', className: 'max-w-md', render: ({ decision }) => <span className="leading-5">{decision.rationale}</span> },
];

interface Props {
	view: PlanWorkspaceView;
}

/** Brainstorm decisions come before the plan's own: the order they were made in. */
export const DecisionsTab = ({ view }: Props) => {
	const rows: LoggedDecision[] = [...(view.brainstormDecisions?.decisions ?? []), ...(view.decisions?.decisions ?? [])].map((decision, index) => ({
		key: `${index}:${decision.question}`,
		decision,
	}));

	return (
		<DataTable
			rows={rows}
			columns={columns}
			getRowKey={({ key }) => key}
			empty={<p className="px-4 py-6 text-muted-foreground text-sm">No decisions recorded — /brainstorm and /plan write them.</p>}
		/>
	);
};
