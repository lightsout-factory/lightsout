import type { RunnableTicket } from '#src/queue/common/types/RunnableTicket.ts';

export interface NamedWorkOrder {
	ticket: RunnableTicket;
	/** The work order's label — its folder under the work-orders directory, and the first segment of every plan address it holds. */
	name: string;
	/** The git branch the record says this work order's plans implement on. Equal to `name` under the default template, and not under a prefixed one. */
	branch: string;
}
