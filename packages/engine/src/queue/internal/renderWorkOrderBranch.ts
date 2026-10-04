import { renderBranchTemplate } from '#src/common/renderBranchTemplate.ts';
import type { TicketSummary } from '#src/queue/common/types/TicketSummary.ts';

interface Params {
	ticket: TicketSummary;
	/** `QueueSettings.branchTemplate` — `{ticket}` and `{slug}` tokens. */
	template: string;
}

// Linear's own `issue.branchName` is deliberately not used: it carries a
// per-user prefix that `ship.ticket-pattern` would not match.
export const renderWorkOrderBranch = ({ ticket, template }: Params): string =>
	renderBranchTemplate({ template, ticketRef: ticket.identifier, title: ticket.title });
