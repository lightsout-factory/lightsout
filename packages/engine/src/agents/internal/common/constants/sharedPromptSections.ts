import frictionSectionPrompt from '#src/agents/prompts/frictionSection.md';
import olderCodeSectionPrompt from '#src/agents/prompts/olderCodeSection.md';

/**
 * The sections every role that writes code or tests reads in the same words,
 * keyed by the token a role prompt marks their place with. A role prompt that
 * restated one would drift from the others, and a standards rule that says
 * "report it" relies on every role meaning the same thing by that.
 */
export const sharedPromptSections = {
	frictionSection: frictionSectionPrompt.trimEnd(),
	olderCodeSection: olderCodeSectionPrompt.trimEnd(),
};
