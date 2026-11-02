import type { PlanDocument } from '@lightsout/engine';
import { useQuery } from '@tanstack/react-query';
import { Markdown } from '#src/common/content/Markdown/Markdown.tsx';
import { CopyButton } from '#src/common/controls/CopyButton.tsx';
import { Dialog } from '#src/common/controls/Dialog.tsx';
import { Skeleton } from '#src/common/panels/Skeleton.tsx';
import { planQueryOptions } from '#src/runDetail/planQueryOptions.ts';
import { WorklistView } from '#src/runDetail/RunDetailScreen/PlanDrawer/WorklistView.tsx';

const getRawText = ({ plan }: { plan: PlanDocument }) => {
	const payload = plan.worklist ?? plan.coverageWorklist;

	return plan.text ?? (payload === undefined ? undefined : JSON.stringify(payload, null, 2));
};

const PlanBody = ({ plan }: { plan: PlanDocument }) => {
	if (plan.text !== undefined) {
		return <Markdown text={plan.text} />;
	}

	if (plan.worklist !== undefined || plan.coverageWorklist !== undefined) {
		return <WorklistView plan={plan} />;
	}

	return (
		<p className="text-muted-foreground text-sm">
			Nothing is on disk at <span className="font-mono">{plan.path}</span> — a plan deleted after its run is a normal state, not an error.
		</p>
	);
};

/** Its own component so the fetch exists only while the drawer is open. */
const PlanDialog = ({ path, onClose }: { path: string; onClose: () => void }) => {
	const { data: plan } = useQuery(planQueryOptions({ path }));
	const raw = plan === undefined ? undefined : getRawText({ plan });

	return (
		<Dialog open onOpenChange={() => onClose()} title={path} action={raw === undefined ? null : <CopyButton value={raw} label="Copy raw" />}>
			{plan === undefined ? <Skeleton className="h-64 w-full" /> : <PlanBody plan={plan} />}
		</Dialog>
	);
};

interface Props {
	/** Repo-relative plan path the drawer is showing; nothing is open when this is absent. */
	path?: string;
	onClose: () => void;
}

export const PlanDrawer = ({ path, onClose }: Props) => (path === undefined ? null : <PlanDialog path={path} onClose={onClose} />);
