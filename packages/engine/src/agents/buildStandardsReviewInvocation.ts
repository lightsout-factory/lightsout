import standardsReviewerPrompt from '#src/agents/prompts/standardsReviewer.md';

interface Params {
	/** Judgment-only rules in scope: id, document path, and full prose. */
	rules: { id: string; documentPath: string; prose: string }[];
	/** Repo-relative files the review covers. */
	files: string[];
}

const ruleSection = ({ rule }: { rule: Params['rules'][number] }) => `**Rule id: \`${rule.id}\`**\n\n${rule.prose}`;

/**
 * The rules ride the system prompt because they are identical on every review
 * this repo runs, so the harness caches through them. Each rule's prose goes in
 * whole: a summary would let the reviewer match the headline and miss every
 * case the author did not spell out.
 */
export const buildStandardsReviewInvocation = ({ rules, files }: Params): { systemPrompt: string; prompt: string } => {
	const byDocument = new Map<string, Params['rules']>();

	for (const rule of rules) {
		byDocument.set(rule.documentPath, [...(byDocument.get(rule.documentPath) ?? []), rule]);
	}

	const documents = [...byDocument.entries()].map(([path, group]) => `## ${path}\n\n${group.map((rule) => ruleSection({ rule })).join('\n\n')}`);

	return {
		systemPrompt: [standardsReviewerPrompt, `# Rules to review against\n\n${documents.join('\n\n')}`].join('\n\n---\n\n'),
		prompt: [
			`# Files in scope for the standards review\n\n${files.map((file) => `- ${file}`).join('\n')}`,
			'Remember: your entire final message must be exactly one JSON report object — nothing else.',
		].join('\n\n'),
	};
};
