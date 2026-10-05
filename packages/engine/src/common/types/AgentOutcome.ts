import type { AgentUsage } from '#src/contracts/run/AgentUsage.ts';

/**
 * A union rather than optional fields, because an invocation that returns no
 * report always knows why; narrowing on `ok` makes the reason a plain string.
 *
 * Usage rides on both arms: a failed attempt still burns tokens.
 */
export type AgentOutcome<Report> =
	| { ok: true; report: Report; usage?: AgentUsage }
	| {
			ok: false;
			failure: string;
			/** The harness hit its subscription limit — the caller parks rather than fails. */
			rateLimited: boolean;
			usage?: AgentUsage;
	  };
