import { acceptanceTestsSection } from '#src/agents/common/acceptanceTestsSection.ts';
import { applyPromptTokens } from '#src/agents/common/applyPromptTokens.ts';
import { sharedPromptSections } from '#src/agents/common/constants/sharedPromptSections.ts';
import unitTestWriterPrompt from '#src/agents/prompts/unitTestWriter.md';
import type { AcceptanceTestRecord } from '#src/contracts/run/AcceptanceTestRecord.ts';

interface Params {
	planContent: string;
	/** Changed files that must execute under the tests. */
	files: string[];
	/** Optional consumer test standards content, inlined verbatim. */
	standards?: string;
	/** Verification-gate output from a failed attempt, for fix re-invocations. */
	errorContext?: string;
	/** The tests that define done for this run: the acceptance-test mapping, each row a test file and the name of the case in it. */
	acceptanceTests?: Pick<AcceptanceTestRecord, 'testFile' | 'testName'>[];
}

/**
 * The role prompt, the plan and the test standards are identical across every
 * writer spawned for a run, so they ride the system prompt and the fan-out's
 * spawns share one cached prefix.
 */
export const buildUnitTestWriterInvocation = ({
	planContent,
	files,
	standards,
	errorContext,
	acceptanceTests,
}: Params): { systemPrompt: string; prompt: string } => {
	const roleSections = [
		applyPromptTokens({ text: unitTestWriterPrompt, tokens: sharedPromptSections }),
		`# Plan (context for intended behavior)\n\n${planContent}`,
	];

	if (standards) {
		roleSections.push(`# Standards\n\nThese rules are binding for the tests you write:\n\n${standards}`);
	}

	const sections = [
		`# Changed files your tests must execute\n\n${files.map((file) => `- ${file}`).join('\n')}`,
		'The engine will verify, from the coverage report, that every file listed above executed under the tests — a listed file that never runs fails the verification gate.',
	];

	const acceptance = acceptanceTestsSection({ acceptanceTests });

	if (acceptance) {
		sections.push(acceptance);
	}

	if (errorContext) {
		sections.push(
			`# Verification failure\n\nA previous attempt wrote tests for these files, but the engine's verification gate failed. Fix your tests per your role rules — and if the failure traces to a source defect, report failed instead of adjusting a test.\n\n${errorContext}`,
		);
	}

	sections.push('Remember: your entire final message must be exactly one JSON report object — nothing else.');

	return {
		systemPrompt: roleSections.join('\n\n---\n\n'),
		prompt: sections.join('\n\n'),
	};
};
