import { consultSupervisor } from '#src/common/consultSupervisor.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import { SupervisorDecision } from '#src/contracts/work/SupervisorDecision.ts';
import { getAgentOutcomeStatus } from '#src/invoke/getAgentOutcomeStatus.ts';
import type { VerificationResult } from '#src/pipeline/steps/common/types/VerificationResult.ts';
import type { VerifyContext } from '#src/pipeline/steps/common/types/VerifyContext.ts';
import { verificationOf } from '#src/pipeline/steps/common/verificationOf.ts';
import { withResult } from '#src/pipeline/steps/common/withResult.ts';
import { runFix } from '#src/pipeline/steps/verifyStep/common/runFix.ts';
import type { GuidedRepairOutcome } from '#src/pipeline/steps/verifyStep/runGuidedRepair/GuidedRepairOutcome.ts';

interface Params {
	context: VerifyContext;
	record: StepRecord;
	result: VerificationResult;
}

export const runGuidedRepair = async ({ context, record, result }: Params): Promise<GuidedRepairOutcome> => {
	// A crash, a timeout, a red with no failed family or a gate run that never got the machine leaves
	// the supervisor no verdict to rule on.
	if (
		!result.error ||
		result.failedFamilies.length === 0 ||
		result.crashes.length > 0 ||
		result.timeouts.length > 0 ||
		result.coordination !== undefined ||
		record.verification?.guidedRepairAttempted
	) {
		return { record, result, ruling: undefined };
	}

	const { run, id, planContent } = context;
	const step = `${id}-supervisor`;

	run.progress(`step ${id}: mechanical retries exhausted — consulting supervisor`);

	const stepLevel = run.openStepLevel({ step });
	const verdict = await consultSupervisor({
		driver: run.driver,
		cwd: run.cwd,
		config: run.config,
		planContent,
		stepId: id,
		errorOutput: result.error,
		attempts: record.attempts,
		onEvent: run.agentEventSink({ step }),
		onRejectedOutput: run.persistRejected({ step }),
		activity: stepLevel,
	});

	// Closed before the park branch below, so every exit from here leaves the
	// consult's own level ended.
	stepLevel?.close({ outcome: getAgentOutcomeStatus({ outcome: verdict }) });

	await run.recordUsage({ step, usage: verdict.usage });

	if (!verdict.ok && verdict.rateLimited) {
		return { parked: await run.stop({ record, status: RunStatus.PausedRateLimit, error: run.parkMessage() }) };
	}

	const ruling = verdict.ok ? verdict.report : undefined;
	let next = record;

	if (ruling) {
		run.progress(`step ${id}: supervisor verdict — ${ruling.decision}`);
		next = { ...record, verification: { ...verificationOf({ record }), supervisorDiagnosis: ruling.diagnosis } };
		await run.setStep({ record: next });
	}

	if (ruling?.decision !== SupervisorDecision.Retry || !ruling.guidance) {
		return { record: next, result, ruling };
	}

	next = {
		...next,
		attempts: next.attempts + 1,
		verification: { ...verificationOf({ record: next }), guidedRepairAttempted: true, needsFormatting: true },
	};
	await run.setStep({ record: next });

	const fixed = await runFix({
		context,
		errorContext: `${result.error}\n\n# Supervisor diagnosis\n${ruling.diagnosis}\n\n# Supervisor guidance\n${ruling.guidance}`,
		record: next,
	});

	if ('parked' in fixed) {
		return { parked: fixed.parked };
	}

	const finalRecord = withResult({ record: fixed.record, result: fixed.result });
	await run.setStep({ record: finalRecord });

	return { record: finalRecord, result: fixed.result, ruling };
};
