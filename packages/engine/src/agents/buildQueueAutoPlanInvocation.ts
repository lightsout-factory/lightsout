import queueAutoPlanPrompt from '#src/agents/prompts/queueAutoPlan.md';
import type { AnsweredQuestion } from '#src/common/types/AnsweredQuestion.ts';

interface Params {
	ticketRef: string;
	ticketTitle: string;
	ticketBody: string;
	/** How to invoke the engine from inside the session — the exact granted prefix, e.g. `node /path/to/cli.mjs`. */
	engineCli: string;
	/** The plan address the engine chose, which the session plans in and passes as `--name`. */
	planAddress: string;
	/** The absolute plan folder under the primary checkout, which the session authors the plan's files in. */
	planFolder: string;
	/** The answer to a question this worker asked, folded back in on re-invocation. */
	answeredQuestion?: AnsweredQuestion;
}

/**
 * The prompt sends the session to the auto-plan skill and constrains only what
 * the queue owns: which plan is planned, no interactive questions, every engine
 * subcommand run in the foreground to its exit before the turn ends, one report
 * as the final message, and never a ship or an implement, because the queue runs
 * the build itself. The plan address and its absolute folder are stated because
 * the engine chose them and looks under exactly that folder afterwards; the
 * folder lies outside the worktree, so a path relative to it would land wrong.
 * `engineCli` appears verbatim because it is also the granted command prefix;
 * an instruction the grant does not cover fails only at run time, in a headless
 * session nobody is watching.
 */
export const buildQueueAutoPlanInvocation = ({
	ticketRef,
	ticketTitle,
	ticketBody,
	engineCli,
	planAddress,
	planFolder,
	answeredQuestion,
}: Params): { systemPrompt: string; prompt: string } => {
	const systemPrompt = [queueAutoPlanPrompt, `# Ticket ${ticketRef}: ${ticketTitle}\n\n${ticketBody}`].join('\n\n---\n\n');
	const sections = [
		`# The engine invocation\n\nRun every engine subcommand as:\n\n\`${engineCli} <subcommand>\`\n\nRun each subcommand in the foreground and wait for it to exit before acting on its output or ending the turn.\n\nNothing else is granted to this session.`,
		`# The plan you are planning\n\nPlan exactly this plan and no other:\n\n\`${planAddress}\`\n\nThat is its address, and it names the plan folder \`${planFolder}\`, which lies in the primary checkout, outside this worktree. Run the engine from the worktree and pass the address as \`--name\` to every \`plan\` and \`brainstorm\` subcommand, but author and edit the plan's files in exactly that folder, at that absolute path.\n\nThe engine has already added this plan to the ticket's record, so never run \`work-order add-plan\` or any other \`work-order\` subcommand.`,
	];

	if (answeredQuestion) {
		sections.push(
			`# Your question, answered\n\nYou stopped and asked this. The worktree and the plan folder already hold whatever you had done when you asked — continue from there rather than starting over.\n\nQuestion: ${answeredQuestion.question}\n\nAnswer: ${answeredQuestion.answer}`,
		);
	}

	sections.push('Remember: your entire final message must be exactly one JSON report object — nothing else.');

	return { systemPrompt, prompt: sections.join('\n\n') };
};
