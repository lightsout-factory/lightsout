import { buildRefactorExecutorInvocation } from '#src/agents/buildRefactorExecutorInvocation.ts';
import { buildUnitTestWriterInvocation } from '#src/agents/buildUnitTestWriterInvocation.ts';
import { RefactorScope } from '#src/common/constants/RefactorScope.ts';
import type { SharedCodeFolder } from '#src/common/types/SharedCodeFolder.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';

interface Params {
	planContent: string;
	files: string[];
	standards?: string;
	testStandards?: string;
	findings: StandardsFinding[];
	advisories: StandardsFinding[];
	gateError: string;
	/** Supervisor diagnosis + guidance sections, appended on the guided retry. */
	guidance?: string;
	/** The shared code visible from `files`. Only the refactor executor is shown it; a test writer adds no shared code. */
	sharedCode?: SharedCodeFolder[];
}

/**
 * Coverage routes to the test writer only when it is the only red kind: with
 * mixed failures the coverage red may be downstream of the source break.
 */
export const buildBatchFixInvocation = ({
	planContent,
	files,
	standards,
	testStandards,
	findings,
	advisories,
	gateError,
	guidance,
	sharedCode,
}: Params): { systemPrompt: string; prompt: string } => {
	const errorContext = guidance ? `${gateError}\n\n${guidance}` : gateError;
	const coverageRed = gateError.includes('test-coverage failed') && !/(check|test-unit|build|generate|format) failed/.test(gateError);

	// A fix retry is the same agent still working the same advisory list, so it
	// still accounts for each advisory.
	return coverageRed
		? buildUnitTestWriterInvocation({ planContent, subjects: files, mustExecute: files, standards: testStandards, errorContext })
		: buildRefactorExecutorInvocation({
				scope: RefactorScope.Standalone,
				planContent,
				changedFiles: files,
				standards,
				findings,
				advisories,
				reportAdvisoryOutcomes: true,
				errorContext,
				sharedCode,
			});
};
