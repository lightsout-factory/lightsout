// None of the fields set means success.
export interface WorkerOutcome {
	question?: string;
	error?: string;
	/** True when the error is a question nobody answered — the one park that says the human is away. */
	unanswered?: boolean;
	/** Why the ticket stays open: the worker built everything it could and the work order's record does not authorize shipping it. Never set beside `question` or `error`. */
	open?: string;
}
