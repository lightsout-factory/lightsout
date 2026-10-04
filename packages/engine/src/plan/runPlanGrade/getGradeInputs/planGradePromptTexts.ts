import planDocsCheckPrompt from '#src/agents/prompts/planDocsCheck.md';
import planFindingRecheckPrompt from '#src/agents/prompts/planFindingRecheck.md';
import planGapCheckPrompt from '#src/agents/prompts/planGapCheck.md';
import planGapCheckDecisionsPrompt from '#src/agents/prompts/planGapCheckDecisions.md';
import planGapCheckSurfacePrompt from '#src/agents/prompts/planGapCheckSurface.md';
import planGapCheckWiringPrompt from '#src/agents/prompts/planGapCheckWiring.md';
import planGapJudgePrompt from '#src/agents/prompts/planGapJudge.md';

/**
 * Every brief that shapes a plan-grading pass, in a fixed order. The grade
 * fingerprint hashes these to decide whether a recorded review is still current,
 * so a brief added or split here must join this list or a stale review passes.
 */
export const planGradePromptTexts = [
	planGapCheckPrompt,
	planGapCheckSurfacePrompt,
	planGapCheckWiringPrompt,
	planGapCheckDecisionsPrompt,
	planGapJudgePrompt,
	planDocsCheckPrompt,
	planFindingRecheckPrompt,
];
