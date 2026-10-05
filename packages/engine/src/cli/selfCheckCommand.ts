import { getRequiredFlag } from '#src/cli/common/args/getRequiredFlag.ts';
import { createProgressPrinter } from '#src/cli/common/createProgressPrinter.ts';
import { readRunConfig } from '#src/cli/common/readRunConfig.ts';
import { bold } from '#src/cli/common/terminal/bold.ts';
import { green } from '#src/cli/common/terminal/green.ts';
import { red } from '#src/cli/common/terminal/red.ts';
import { SelfCheckReason } from '#src/common/constants/SelfCheckReason.ts';
import { exitCli } from '#src/common/exitCli.ts';
import { messageOf } from '#src/common/messageOf.ts';
import type { CommandContext } from '#src/common/types/CommandContext.ts';
import type { SelfCheckResult } from '#src/common/types/SelfCheckResult.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import { runSelfCheck } from '#src/gates/runSelfCheck/runSelfCheck.ts';
import { readRunManifest } from '#src/runState/readRunManifest.ts';

interface StepSelfCheck {
	/** Required rather than optional so spreading this always carries the key. */
	checkpoint: string | undefined;
	coverage: boolean;
	wholeRepository: boolean;
}

const verdictLine = "The engine's own gates run afterwards over the full scope and are the only verdict.";

// None of these may read as a check that passed, nor as the change being wrong.
const noGateHeadlines: Record<Exclude<SelfCheckReason, typeof SelfCheckReason.Ran>, string> = {
	[SelfCheckReason.NothingChanged]: 'nothing to check — the tree holds no change yet',
	[SelfCheckReason.NothingScheduled]:
		'no gates were run — the checkpoint this step precedes schedules none, or every package in scope skipped the ones it does',
	[SelfCheckReason.Unavailable]:
		"the engine could not work out what to check — reading this repository's git status failed, which is the engine failing rather than your change being red",
	[SelfCheckReason.Coordination]:
		'no gates were run — another gate run of this repository holds the machine, so this check was still waiting for it rather than your change being red',
};

// The verification checkpoints map too, so a step's fix re-invocation gets the
// same self-check and a byte-identical system prompt.
const selfCheckOfStep = ({ pipeline, step }: { pipeline: PipelineKind | undefined; step: string }): StepSelfCheck | undefined => {
	// The direct pipeline names no checkpoints and runs the root block over the
	// whole tree with coverage on, so its self-check mirrors that rather than the
	// diff-scoped one.
	if (pipeline === PipelineKind.Direct) {
		return step === 'implement' ? { checkpoint: undefined, coverage: true, wholeRepository: true } : undefined;
	}

	// A manifest without the discriminator reads as the implement pipeline, as
	// every other reader treats one.
	if (pipeline !== undefined && pipeline !== PipelineKind.Implement) {
		return undefined;
	}

	if (step === 'implement' || step === 'verify-implement') {
		return { checkpoint: 'verify-implement', coverage: false, wholeRepository: false };
	}

	return step === 'refactor' || step === 'verify-refactor' ? { checkpoint: 'verify-refactor', coverage: true, wholeRepository: false } : undefined;
};

// A one-line error, never a stack trace in the agent's shell.
const readManifest = async ({ cwd, runId }: { cwd: string; runId: string }) => {
	try {
		return { manifest: await readRunManifest({ cwd, runId }) };
	} catch (error) {
		return { error: messageOf({ error }) };
	}
};

const printGateFailures = ({ result }: { result: SelfCheckResult }) => {
	for (const gate of result.gates) {
		// A timed-out attempt never returned a verdict, so it is not evidence about the code.
		if (gate.skipped !== true && gate.timedOut !== true && gate.exitCode !== undefined && gate.exitCode !== 0) {
			console.log(`\n${bold(`[${gate.group}] ${gate.kind}`)} — exit ${gate.exitCode}\n${gate.command}\n${gate.outputTail ?? ''}`);
		}
	}

	// A crash or a timeout is the engine's own failure rather than evidence about
	// the code, so it is printed as one and never handed over as something to
	// repair.
	for (const crash of result.crashes) {
		console.log(`\nengine: ${crash}`);
	}

	for (const timeout of result.timeouts) {
		console.log(`\nengine: ${timeout}`);
	}
};

/**
 * Takes the run id and nothing else, reading the rest from the manifest and the
 * git diff, so an argument an agent appends can never widen what it runs. It never
 * takes the run lock: the run that spawned the agent already holds it.
 */
export const selfCheckCommand = async ({ flags, cwd }: CommandContext): Promise<void> => {
	const runId = await getRequiredFlag({ flags, name: 'run' });
	const found = await readManifest({ cwd, runId });

	if ('error' in found) {
		console.error(`self-check: ${found.error}`);

		return exitCli({ code: 1 });
	}

	const { manifest } = found;
	// The config the run recorded, never the worktree's file, which the agent may have edited.
	const recorded = readRunConfig({ manifest });

	if ('error' in recorded) {
		console.error(`self-check: ${recorded.error}`);

		return exitCli({ code: 1 });
	}

	const { config } = recorded;
	const step = manifest.currentStep;
	const resolved = step === null ? undefined : selfCheckOfStep({ pipeline: manifest.pipeline, step });

	if (step === null || resolved === undefined) {
		console.log(`\n${bold(`self-check ${step ?? 'no step'}`)} — this step has no self-check, so nothing was checked. ${verdictLine}`);

		return exitCli({ code: 0 });
	}

	const result = await runSelfCheck({ cwd, config, ...resolved, runId: manifest.runId, step, onProgress: createProgressPrinter() });
	const failed = result.reason === SelfCheckReason.Ran && result.error !== undefined;
	const ranHeadline = failed ? red('gates red') : green('passed');
	const headline = result.reason === SelfCheckReason.Ran ? ranHeadline : noGateHeadlines[result.reason];
	const scheduled = result.gateNames.length === 0 ? '' : ` (${result.gateNames.join(', ')})`;

	console.log(`\n${bold(`self-check ${step}`)} — ${headline}${scheduled}. ${verdictLine}`);

	// Who holds the machine, in which worktree, and for how long — printed under
	// the headline, and never alongside gate evidence, because no gate ran.
	if (result.coordination !== undefined) {
		console.log(`\n${result.coordination}`);
	}

	if (result.reason === SelfCheckReason.Ran) {
		printGateFailures({ result });
	}

	return exitCli({ code: failed ? 1 : 0 });
};
