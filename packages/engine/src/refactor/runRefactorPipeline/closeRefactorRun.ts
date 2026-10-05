import type { RefactorWorklist } from '#src/contracts/refactor/RefactorWorklist.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { describeIntroducedFindings } from '#src/refactor/closeRefactorRun/describeIntroducedFindings.ts';
import { findIntroducedFindings } from '#src/refactor/common/findIntroducedFindings.ts';
import type { RefactorRun } from '#src/refactor/common/RefactorRun.ts';
import type { RefactorResult } from '#src/refactor/RefactorResult.ts';
import { countByRule } from '#src/refactor/runRefactorPipeline/common/countByRule.ts';
import { runStandardsCheck } from '#src/standardsCheck/runStandardsCheck/runStandardsCheck.ts';

interface Params {
	run: RefactorRun;
	/** The frozen work-list — its scope drives the re-check, its findings are what the run owed. */
	worklist: RefactorWorklist;
}

export const closeRefactorRun = async ({ run, worklist }: Params): Promise<RefactorResult> => {
	const finalCheck = await runStandardsCheck({
		cwd: run.cwd,
		config: run.config,
		path: worklist.path === '.' ? undefined : worklist.path,
		all: worklist.all,
		persist: false,
	});
	// Finding severity only, mirroring the worklist filter — the burn-down
	// compares work against work, never advisories.
	const after = countByRule({ findings: finalCheck.findings.filter((finding) => finding.severity === StandardsSeverity.Blocking) });
	const introduced = findIntroducedFindings({
		frozen: worklist.batches.flatMap((batch) => batch.blocking),
		live: finalCheck.findings,
		severity: StandardsSeverity.Blocking,
	});

	// It rides out carrying the real `after` rather than the halted default:
	// the burn-down table is the evidence for what just happened, and this is
	// the run where the reader most needs to read it.
	if (introduced.length > 0) {
		const stopped = await run.stop({
			record: { id: 'final-check', status: RunStatus.Running, attempts: 1 },
			status: RunStatus.Failed,
			error: describeIntroducedFindings({ findings: introduced }),
		});

		return { ...stopped, after };
	}

	await run.update({ patch: { status: RunStatus.Passed, currentStep: null } });

	return { ok: true, manifest: run.current(), declined: run.declined, before: run.before, after };
};
