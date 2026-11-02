import { useSuspenseQuery } from '@tanstack/react-query';
import { Tabs } from '#src/common/controls/Tabs.tsx';
import { ContentHeader } from '#src/common/headers/ContentHeader.tsx';
import { DecisionsTab } from '#src/plans/PlanDetailScreen/DecisionsTab.tsx';
import { DedupTab } from '#src/plans/PlanDetailScreen/DedupTab.tsx';
import { FactsTab } from '#src/plans/PlanDetailScreen/FactsTab.tsx';
import { GradeTab } from '#src/plans/PlanDetailScreen/GradeTab.tsx';
import { NotesTab } from '#src/plans/PlanDetailScreen/NotesTab.tsx';
import { PlanDetailTab } from '#src/plans/PlanDetailScreen/PlanDetailTab.ts';
import { PlanHeader } from '#src/plans/PlanDetailScreen/PlanHeader.tsx';
import { PlanTab } from '#src/plans/PlanDetailScreen/PlanTab/PlanTab.tsx';
import { planWorkspaceQueryOptions } from '#src/plans/planWorkspaceQueryOptions.ts';

interface Props {
	/** The workspace's kebab folder name, which is what the URL carries. */
	name: string;
}

/**
 * The active tab is component state rather than a URL parameter: a tab is where
 * a reader is looking, not something worth sending in a link.
 */
export const PlanDetailScreen = ({ name }: Props) => {
	const { data: view } = useSuspenseQuery(planWorkspaceQueryOptions({ name }));

	return (
		<div className="flex flex-col gap-6 p-6">
			<ContentHeader crumbs={[{ label: 'Your repo', link: { to: '/app' } }, { label: 'Plans', link: { to: '/app/plans' } }, { label: view.listing.name }]} />
			<PlanHeader view={view} />
			<Tabs
				items={[
					{ value: PlanDetailTab.Plan, label: 'Plan', content: <PlanTab view={view} /> },
					{ value: PlanDetailTab.Decisions, label: 'Decisions', content: <DecisionsTab view={view} /> },
					{ value: PlanDetailTab.Facts, label: 'Facts', content: <FactsTab facts={view.facts} /> },
					{ value: PlanDetailTab.Grade, label: 'Grade', content: <GradeTab grade={view.grade} /> },
					{ value: PlanDetailTab.Dedup, label: 'Dedup', content: <DedupTab dedup={view.dedup} /> },
					{ value: PlanDetailTab.Notes, label: 'Notes', content: <NotesTab view={view} /> },
				]}
			/>
		</div>
	);
};
