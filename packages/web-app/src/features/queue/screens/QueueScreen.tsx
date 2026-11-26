import { QueueBoardState, type QueueBoardTicket, type QueueView, queueLaneLabels } from '@lightsout/engine/contracts';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { SitePageFrame } from '#src/components/site/SitePageFrame.tsx';
import { SiteSection } from '#src/components/site/SiteSection.tsx';
import { queueViewQueryOptions } from '#src/features/queue/queries/queueViewQueryOptions.ts';
import { formatLocalTime } from '#src/utils/formatLocalTime.ts';

/** Labelled so a stopped or finished drain is never mistaken for a live board. */
const stateLine = ({ state, at }: { state: QueueBoardState; at: string }) => {
	const time = formatLocalTime({ iso: at });
	const lines: Record<QueueBoardState, string> = {
		[QueueBoardState.Live]: `Queue live · updated ${time}`,
		[QueueBoardState.Stopped]: `Queue stopped · last update ${time}`,
		[QueueBoardState.Finished]: `Queue finished · ${time}`,
	};

	return lines[state];
};

/** The identifier links out only when the board carries the ticket's link; the app never asks the tracker. */
const TicketRow = ({ ticket }: { ticket: QueueBoardTicket }) => (
	<li className="flex flex-col gap-1 px-5 py-3 text-sm">
		<div className="flex flex-wrap items-center gap-x-4 gap-y-1">
			{ticket.url === undefined ? (
				<span className="font-mono">{ticket.identifier}</span>
			) : (
				<a href={ticket.url} target="_blank" rel="noreferrer" className="font-mono text-brand-to underline underline-offset-4">
					{ticket.identifier}
				</a>
			)}
			{ticket.title === undefined ? null : <span className="font-semibold">{ticket.title}</span>}
			{ticket.workOrderName === undefined ? null : (
				<Link to="/app/work-orders/$workOrder" params={{ workOrder: ticket.workOrderName }} className="font-mono text-drop-navy text-xs hover:text-primary">
					{ticket.workOrderName}
				</Link>
			)}
		</div>
		{ticket.reason === undefined ? null : <p className="text-muted-foreground">{ticket.reason}</p>}
		{ticket.question === undefined ? null : <p className="text-muted-foreground">Asks: {ticket.question}</p>}
	</li>
);

const Drain = ({ drain }: { drain: NonNullable<QueueView['drain']> }) => (
	<>
		<p className="text-muted-foreground">{stateLine({ state: drain.state, at: drain.at })}</p>
		{drain.lanes.length === 0 ? <p className="text-muted-foreground">This drain recorded no tickets.</p> : null}
		{drain.lanes.map(({ lane, tickets }) => (
			<SiteSection key={lane} title={queueLaneLabels[lane]}>
				<ul className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
					{tickets.map((ticket) => (
						<TicketRow key={ticket.identifier} ticket={ticket} />
					))}
				</ul>
			</SiteSection>
		))}
	</>
);

/** The latest queue drain on disk, one section per lane that holds tickets. */
export const QueueScreen = () => {
	const { data: view } = useSuspenseQuery(queueViewQueryOptions());

	return (
		<SitePageFrame>
			<h1 className="font-extrabold text-4xl text-drop-navy tracking-tight md:text-5xl">Queue</h1>
			{view.drain === undefined ? <p className="text-muted-foreground">The queue has not run.</p> : <Drain drain={view.drain} />}
		</SitePageFrame>
	);
};
