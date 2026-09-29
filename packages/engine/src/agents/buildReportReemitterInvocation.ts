import reportReemitterPrompt from '#src/agents/prompts/reportReemitter.md';

interface Params {
	/** The agent's raw final message that failed contract validation. */
	rejectedText: string;
	/** The zod validation error, so the agent sees exactly what was wrong. */
	validationError: string;
}

/**
 * Re-emitting from the rejected message is far cheaper than re-running the
 * whole role when only the report's shape was wrong. The role's own system
 * prompt carries the contract and is reused, so this builds only the user
 * prompt.
 */
export const buildReportReemitterInvocation = ({ rejectedText, validationError }: Params): { prompt: string } => {
	const sections = [reportReemitterPrompt, `# Validation error\n\n${validationError}`, `# Your previous final message\n\n${rejectedText}`];

	return {
		prompt: sections.join('\n\n'),
	};
};
