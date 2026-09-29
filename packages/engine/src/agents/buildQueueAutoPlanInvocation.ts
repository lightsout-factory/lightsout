import queueAutoPlanPrompt from '#src/agents/prompts/queueAutoPlan.md';
import type { AnsweredQuestion } from '#src/common/types/AnsweredQuestion.ts';
import { planWorkspacePath } from '#src/plan/planWorkspacePath.ts';

interface Params {
	ticketRef: string;
	ticketTitle: string;
	ticketBody: string;
	/** How to invoke the engine from inside the session — the exact granted prefix, e.g. `node /path/to/cli.mjs`. */
	engineCli: string;
	/** The plan address the engine chose, which the session plans in and passes as `--name`. */
	planAddress: string;
	/** The answer to a question this worker asked, folded back in on re-invocation. */
	answeredQuestion?: AnsweredQuestion;
}

/**
 * The prompt sends the session to the auto-plan skill and constrains only what
 * the queue owns: which plan is planned, no interactive questions, one report as
 * the final message, and never a ship or an implement, because the queue runs
 * the build itself. The plan address is stated because the engine chose it and
 * looks under exactly that folder afterwards. `engineCli` appears verbatim
 * because it is also the granted command prefix; an instruction the grant does
 * not cover fails only at run time, in a headless session nobody is watching.
 */
export const buildQueueAutoPlanInvocation = ({
	ticketRef,
	ticketTitle,
	ticketBody,
	engineCli,
	planAddress,
	answeredQuestion,
}: Params): { systemPrompt: string; prompt: string } => {
	const systemPrompt = [queueAutoPlanPrompt, `# Ticket ${ticketRef}: ${ticketTitle}\n\n${ticketBody}`].join('\n\n---\n\n');
	const sections = [
		`# The engine invocation\n\nRun every engine subcommand as:\n\n\`${engineCli} <subcommand>\`\n\nNothing else is granted to this session.`,
		`# The plan you are planning\n\nPlan exactly this plan and no other:\n\n\`${planAddress}\`\n\nThat is its address, and \`${planWorkspacePath({ name: planAddress })}\` is the folder in this worktree it names. Pass the address as \`--name\` to every \`plan\` and \`brainstorm\` subcommand, and leave the plan's files in exactly that folder.\n\nThe engine has already added this plan to the ticket's record, so never run \`work-order add-plan\` or any other \`work-order\` subcommand.`,
	];

	if (answeredQuestion) {
		sections.push(
			`# Your question, answered\n\nYou stopped and asked this. The worktree already holds whatever you had done when you asked — continue from there rather than starting over.\n\nQuestion: ${answeredQuestion.question}\n\nAnswer: ${answeredQuestion.answer}`,
		);
	}

	sections.push('Remember: your entire final message must be exactly one JSON report object — nothing else.');

	return { systemPrompt, prompt: sections.join('\n\n') };
};
