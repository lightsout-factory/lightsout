import { useState } from 'react';
import { Tabs } from '#src/common/controls/Tabs.tsx';
import type { RunDetailView } from '#src/runDetail/common/types/RunDetailView.ts';
import { ChangedFilesPanel } from '#src/runDetail/RunDetailScreen/RunDetailBody/ChangedFilesPanel.tsx';
import { FrictionPanel } from '#src/runDetail/RunDetailScreen/RunDetailBody/FrictionPanel.tsx';
import { RunAgentsTab } from '#src/runDetail/RunDetailScreen/RunDetailBody/RunAgentsTab/RunAgentsTab.tsx';
import { RunDetailTab } from '#src/runDetail/RunDetailScreen/RunDetailBody/RunDetailTab.ts';
import { RunGatesTab } from '#src/runDetail/RunDetailScreen/RunDetailBody/RunGatesTab/RunGatesTab.tsx';
import { RunHeader } from '#src/runDetail/RunDetailScreen/RunDetailBody/RunHeader/RunHeader.tsx';
import { RunOverviewTab } from '#src/runDetail/RunDetailScreen/RunDetailBody/RunOverviewTab/RunOverviewTab.tsx';
import { RunStepsTab } from '#src/runDetail/RunDetailScreen/RunDetailBody/RunStepsTab/RunStepsTab.tsx';

interface Props {
	view: RunDetailView;
	/** Opens a repo-relative plan path in the drawer the page owns. */
	onOpenPlan: (path: string) => void;
}

export const RunDetailBody = ({ view, onOpenPlan }: Props) => {
	const [tab, setTab] = useState<string>(RunDetailTab.Overview);

	const openStep = (stepId: string) => {
		setTab(RunDetailTab.Steps);
		// The card only joins the tree with the Steps panel, so the scroll waits
		// for the frame that mounts it.
		requestAnimationFrame(() => document.getElementById(`step-${stepId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
	};

	return (
		<div className="flex flex-col gap-6 p-8">
			<RunHeader view={view} onOpenPlan={onOpenPlan} />
			<Tabs
				value={tab}
				onValueChange={setTab}
				items={[
					{
						value: RunDetailTab.Overview,
						label: 'Overview',
						content: <RunOverviewTab view={view} onOpenStep={openStep} />,
					},
					{ value: RunDetailTab.Steps, label: 'Steps', content: <RunStepsTab view={view} onOpenPlan={onOpenPlan} /> },
					{ value: RunDetailTab.Gates, label: 'Gates', content: <RunGatesTab view={view} /> },
					{ value: RunDetailTab.Agents, label: 'Agents', content: <RunAgentsTab view={view} /> },
					{
						value: RunDetailTab.Files,
						label: 'Files',
						content: <ChangedFilesPanel files={view.changedFiles} />,
					},
					{ value: RunDetailTab.Friction, label: 'Friction', content: <FrictionPanel records={view.friction} /> },
				]}
			/>
		</div>
	);
};
