import standardsReviewerPrompt from '#src/agents/prompts/standardsReviewer.md';

interface Params {
	/**
	 * The rules an agent reviews, in scope: full `<library>/<rule-id>` name,
	 * document path, full prose, whether a code check already covers part of
	 * the rule, and — when the rule does not apply to every package the review
	 * covers — the label of the packages it applies to.
	 */
	rules: { name: string; documentPath: string; prose: string; checked: boolean; appliesTo?: string }[];
	/** Repo-relative files the review covers. */
	files: string[];
}

/** Said per rule rather than once, so the reviewer never has to guess which rules a check already half covers. */
const ruleSection = ({ rule }: { rule: Params['rules'][number] }) => {
	const scope = rule.appliesTo === undefined ? [] : [`Applies only to: ${rule.appliesTo} — judge this rule only in files of those packages.`];
	const checked = rule.checked ? ['A code check already reports part of this rule. Report only what that check could not have found.'] : [];

	return [`**Rule: \`${rule.name}\`**`, ...scope, ...checked, rule.prose].join('\n\n');
};

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
