import { createInterface, type Interface } from 'node:readline/promises';
import type { QuestionRelay } from '#src/queue/common/types/QuestionRelay.ts';
import type { QueueSettings } from '#src/queue/common/types/QueueSettings.ts';
import type { TicketSummary } from '#src/queue/common/types/TicketSummary.ts';
import { recordRelayedAnswer } from '#src/queue/relay/internal/recordRelayedAnswer.ts';
import type { TrackerSettings } from '#src/ticketTracker/common/types/TrackerSettings.ts';

/** Said both by a drain whose input was closed before it asked, and by one whose terminal went away mid-question — one fact, one wording. */
const noTerminalMessage = 'there is no terminal to answer on — run `lightsout queue` attached to one';

interface ConstructorParams {
	settings: QueueSettings;
	trackerSettings: TrackerSettings;
	input: NodeJS.ReadableStream;
	output: NodeJS.WritableStream;
}

/**
 * Progress is held back while a question is on screen; without that buffer the
 * other in-flight workers scroll the question away, which defeats the
 * one-terminal contract the queue is built on.
 */
export class TerminalQuestionRelay implements QuestionRelay {
	private readonly settings: QueueSettings;
	private readonly trackerSettings: TrackerSettings;
	private readonly output: NodeJS.WritableStream;
	private readonly terminal: Interface;
	// Each `ask` awaits its predecessor, so the terminal never holds two
	// half-written prompts.
	private chain: Promise<unknown> = Promise.resolve();
	private prompting = false;
	private held: string[] = [];
	private ended = false;
	private abandonPrompt?: (error: Error) => void;

	constructor({ settings, trackerSettings, input, output }: ConstructorParams) {
		this.settings = settings;
		this.trackerSettings = trackerSettings;
		this.output = output;
		this.terminal = createInterface({ input, output });
		// A drain started with no terminal attached ends its input immediately.
		// Without this the open question would wait forever on a line nobody can
		// type, and the whole drain would hang on one ticket.
		this.terminal.on('close', () => {
			this.ended = true;
			this.abandonPrompt?.(new Error(noTerminalMessage));
		});
	}

	/**
	 * Serialized: a second caller waits until the first answer is in. The answer
	 * is on disk and on the ticket before this resolves, so a worker never acts
	 * on a decision nothing recorded.
	 *
	 * @throws {Error} When there is no terminal to answer on (EOF or a closed input).
	 */
	ask({
		question,
		ticket,
		coordinatorRunId,
		coordinatorRunDir,
	}: {
		question: string;
		ticket: TicketSummary;
		coordinatorRunId: string;
		/** The queue's own run directory in the main checkout — the one place the queue writes records. */
		coordinatorRunDir: string;
	}): Promise<string> {
		const answered = this.chain
			.then(() => this.putQuestion({ question, ticket }))
			.then(async (answer) => {
				await recordRelayedAnswer({
					settings: this.settings,
					trackerSettings: this.trackerSettings,
					question,
					answer,
					ticket,
					coordinatorRunId,
					coordinatorRunDir,
					onProgress: this.createProgressSink({ ticket }),
				});

				return answer;
			});

		// The chain must survive a rejected ask: a ticket that could not be
		// answered parks, and every other in-flight worker keeps its turn.
		this.chain = answered.catch(() => undefined);

		return answered;
	}

	createProgressSink({ ticket }: { ticket: TicketSummary }): (message: string) => void {
		return (message: string) => this.write({ line: `${ticket.identifier} · ${message}` });
	}

	close(): void {
		this.terminal.close();
	}

	private async putQuestion({ question, ticket }: { question: string; ticket: TicketSummary }) {
		if (this.ended) {
			throw new Error(noTerminalMessage);
		}

		this.prompting = true;

		const abandoned = new Promise<never>((_resolve, reject) => {
			this.abandonPrompt = reject;
		});

		try {
			this.output.write(`\n${ticket.identifier} ${ticket.title}\n${question}\n`);

			for (;;) {
				// An accidental enter must not send a blank answer to a worker that
				// will act on it, so an empty line asks again. A closed input does
				// not: there is nobody there to type a second time.
				const typed = await Promise.race([this.terminal.question('answer: '), abandoned]);

				if (typed.trim() !== '') {
					return typed.trim();
				}
			}
		} finally {
			this.abandonPrompt = undefined;
			this.prompting = false;
			this.flush();
		}
	}

	private write({ line }: { line: string }) {
		if (this.prompting) {
			this.held.push(line);

			return;
		}

		this.output.write(`${line}\n`);
	}

	private flush() {
		const held = this.held;

		this.held = [];

		for (const line of held) {
			this.output.write(`${line}\n`);
		}
	}
}
