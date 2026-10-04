import type { TicketSummary } from '#src/common/types/TicketSummary.ts';

export interface QuestionRelay {
	/**
	 * The answer is on disk and on the ticket before this resolves, so a worker
	 * never acts on a decision nothing recorded.
	 *
	 * @throws {Error} When the question can never be answered — no terminal, a
	 * closed relay, or an elapsed question timeout. The caller parks the ticket.
	 */
	ask(params: { question: string; ticket: TicketSummary; coordinatorRunId: string; coordinatorRunDir: string }): Promise<string>;

	createProgressSink(params: { ticket: TicketSummary }): (message: string) => void;

	/** Release whatever the relay holds. Called once, on the way out of the command. */
	close(): void;
}
