import { renderResult } from '#src/cli/common/implementRun/finishImplementRun/renderResult/renderResult.ts';
import { shipAfterImplement } from '#src/cli/common/implementRun/finishImplementRun/shipAfterImplement/shipAfterImplement.ts';
import { exitCli } from '#src/common/exitCli.ts';
import { messageOf } from '#src/common/messageOf.ts';
import type { CommandContext } from '#src/common/types/CommandContext.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { PipelineResult } from '#src/pipeline/PipelineResult.ts';
import { writeRunFinalReport } from '#src/runState/finalReport/writeRunFinalReport.ts';
import { isRunPaused } from '#src/runState/isRunPaused.ts';

interface Params {
	/** The config as it was read from disk, before the command stamped its harness on it. */
	config: LightsoutConfig;
	/** The workspace the run built in — the tree the result describes and the branch ship would push. */
	cwd: string;
	result: PipelineResult;
	flags: CommandContext['flags'];
}

/** The run's error as it is printed and saved: one blank line, then the error. Empty when the run passed or carries none. */
const renderErrorLines = ({ result }: { result: PipelineResult }) => (result.ok || result.error === undefined ? [] : ['', result.error]);

// A report that cannot be saved must not turn a passed run into a failed command.
const saveFinalReport = async ({ cwd, runId, lines, exitCode }: { cwd: string; runId: string; lines: string[]; exitCode: number }) => {
	try {
		await writeRunFinalReport({ cwd, runId, report: { lines, exitCode, finishedAt: new Date().toISOString() } });
	} catch (error) {
		console.error(`could not save the final report of run ${runId}: ${messageOf({ error })}`);
	}
};

/**
 * The report is saved only after ship, because ship decides the code the
 * process exits with, and the saved code must be that one.
 */
export const finishImplementRun = async ({ config, cwd, result, flags }: Params): Promise<never> => {
	const reportLines = await renderResult({ result, cwd });
	const errorLines = renderErrorLines({ result });

	for (const line of reportLines) {
		console.log(line);
	}

	// A run parked at a rate-limit wall says how to pick it up again. That is
	// guidance, not a fault, and stderr reads as a fault.
	if (errorLines.length > 0 && isRunPaused({ status: result.manifest.status })) {
		console.log(errorLines.join('\n'));
	} else if (errorLines.length > 0) {
		console.error(errorLines.join('\n'));
	}

	const code = await shipAfterImplement({
		config,
		cwd,
		result,
		shipFlag: flags.get('ship') === true,
		noShipFlag: flags.get('no-ship') === true,
		env: process.env,
	});

	await saveFinalReport({
		cwd,
		runId: result.manifest.parentRunId ?? result.manifest.runId,
		lines: [...reportLines, ...errorLines],
		exitCode: code,
	});

	return exitCli({ code });
};
