import { getRequiredFlag } from '#src/cli/common/args/getRequiredFlag.ts';
import { createProgressPrinter } from '#src/cli/common/createProgressPrinter.ts';
import { bold } from '#src/cli/common/terminal/bold.ts';
import { green } from '#src/cli/common/terminal/green.ts';
import { red } from '#src/cli/common/terminal/red.ts';
import { printStructuralFinding } from '#src/cli/plan/planCommand/common/printStructuralFinding.ts';
import { PlanRunStatus } from '#src/common/constants/PlanRunStatus.ts';
import { exitCli } from '#src/common/exitCli.ts';
import { getBlockingFindings } from '#src/common/findings/getBlockingFindings.ts';
import type { CommandContext } from '#src/common/types/CommandContext.ts';
import { runPlanLint } from '#src/plan/runPlanLint.ts';

export const planLintCommand = async ({ flags, cwd }: CommandContext): Promise<void> => {
	const name = await getRequiredFlag({ flags, name: 'name' });
	const result = await runPlanLint({ cwd, name, onProgress: createProgressPrinter() });

	if (result.status === PlanRunStatus.Failed) {
		console.error(`\n${result.error}`);
		return exitCli({ code: 1 });
	}

	const { findings, planPaths } = result;
	const blocking = getBlockingFindings({ findings });
	const advisory = findings.length - blocking.length;
	const headline = blocking.length === 0 ? green('clean') : red(`${blocking.length} blocking finding(s)`);
	const note = advisory === 0 ? '' : `, ${advisory} advisory finding(s)`;

	console.log(`\n${bold(`plan lint ${name}`)} — ${headline}${note} (${planPaths.length} file(s))`);

	for (const finding of findings) {
		printStructuralFinding({ finding });
	}

	// Only a blocking finding moves the exit code, which the writer's self-lint loop reads.
	return exitCli({ code: blocking.length > 0 ? 1 : 0 });
};
