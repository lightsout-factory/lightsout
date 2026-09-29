import { RunStatus } from '@lightsout/engine/contracts';
import { MetadataTag } from '#src/appUI/badges/MetadataTag.tsx';
import { CopyButton } from '#src/appUI/buttons/CopyButton.tsx';
import type { RunDetailView } from '#src/features/runDetail/internal/common/types/RunDetailView.ts';

/** These states carry no failing step or error, so without a sentence all a reader sees is a badge. */
const stateSentences: Partial<Record<RunStatus, string>> = {
	[RunStatus.PausedRateLimit]: 'Paused at the harness rate limit — resume when the window resets.',
	[RunStatus.PausedBudget]: 'Paused at the batch ceiling you set — resume to continue.',
	[RunStatus.Escalated]: 'Escalated — the supervisor asked for a human decision; read the step’s report, then resume.',
};

const findOpenStep = ({ view }: { view: RunDetailView }) => {
	const failed = view.steps.find((step) => step.status === RunStatus.Failed);
	const unfinished = [...view.steps].reverse().find((step) => step.status !== RunStatus.Passed);

	return failed ?? unfinished;
};

interface Props {
	view: RunDetailView;
}

/** The resume line follows the manifest's own `resumable`, so this and the runs table never disagree about which runs offer one. */
export const RunWhatNow = ({ view }: Props) => {
	const { listing } = view;

	if (listing.status === RunStatus.Passed || listing.status === RunStatus.Pending) {
		return null;
	}

	const step = findOpenStep({ view });
	const sentence = stateSentences[listing.status];
	const failure = listing.status === RunStatus.Failed ? step?.error?.split('\n')[0] : undefined;
	const resumeCommand = `lightsout resume --run ${listing.shortId}`;

	return (
		<div className="flex flex-col items-start gap-2 rounded-md border border-border bg-muted px-3 py-2">
			<p className="text-sm">
				{listing.status === RunStatus.Running ? 'working on ' : 'stopped at '}
				<MetadataTag>{step?.id ?? view.currentStep ?? 'nothing yet'}</MetadataTag>
			</p>
			{failure === undefined ? null : <p className="text-sm text-status-failed">{failure}</p>}
			{sentence === undefined ? null : <p className="text-muted-foreground text-sm">{sentence}</p>}
			{listing.resumable ? (
				<div className="flex items-center gap-2">
					<code className="rounded-md bg-background px-2 py-1 font-mono text-xs">{resumeCommand}</code>
					<CopyButton value={resumeCommand} label="Copy resume command" />
				</div>
			) : null}
		</div>
	);
};
