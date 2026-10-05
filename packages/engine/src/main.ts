import { brainstormCommand } from '#src/cli/brainstorm/brainstormCommand/brainstormCommand.ts';
import { doctorCommand } from '#src/cli/doctorCommand.ts';
import { frictionCommand } from '#src/cli/frictionCommand.ts';
import { getUnknownFlagsMessage } from '#src/cli/getUnknownFlagsMessage/getUnknownFlagsMessage.ts';
import { implementCommand } from '#src/cli/implementCommand/implementCommand.ts';
import { implementDirectCommand } from '#src/cli/implementDirectCommand/implementDirectCommand.ts';
import { improveCommand } from '#src/cli/improveCommand/improveCommand.ts';
import { loadRepoEnvFile } from '#src/cli/loadRepoEnvFile.ts';
import { parseFlags } from '#src/cli/parseFlags.ts';
import { planCommand } from '#src/cli/plan/planCommand/planCommand.ts';
import { queueCommand } from '#src/cli/queueCommand.ts';
import { refactorCommand } from '#src/cli/refactorCommand/refactorCommand.ts';
import { reportCommand } from '#src/cli/reportCommand/reportCommand.ts';
import { resumeCommand } from '#src/cli/resumeCommand/resumeCommand.ts';
import { selfCheckCommand } from '#src/cli/selfCheckCommand.ts';
import { shipCommand } from '#src/cli/shipCommand/shipCommand.ts';
import { standardsCheckCommand } from '#src/cli/standards/standardsCheckCommand/standardsCheckCommand.ts';
import { standardsHealthCommand } from '#src/cli/standards/standardsHealthCommand/standardsHealthCommand.ts';
import { standardsValidateCommand } from '#src/cli/standards/standardsValidateCommand.ts';
import { statusCommand } from '#src/cli/statusCommand/statusCommand.ts';
import { stopCommand } from '#src/cli/stopCommand/stopCommand.ts';
import { testCoverageToThresholdCommand } from '#src/cli/testCoverageToThresholdCommand/testCoverageToThresholdCommand.ts';
import { ticketStateCommand } from '#src/cli/ticketStateCommand.ts';
import { voiceCommand } from '#src/cli/voice/voiceCommand/voiceCommand.ts';
import { workOrderCommand } from '#src/cli/workOrder/workOrderCommand/workOrderCommand.ts';
import { usage } from '#src/common/constants/usage.ts';
import { exitCli } from '#src/common/exitCli.ts';
import { getStringFlag } from '#src/common/getStringFlag.ts';
import type { CommandContext } from '#src/common/types/CommandContext.ts';

const commands: Record<string, (context: CommandContext) => Promise<void>> = {
	implement: implementCommand,
	'implement-direct': implementDirectCommand,
	queue: queueCommand,
	resume: resumeCommand,
	stop: stopCommand,
	ship: shipCommand,
	'self-check': selfCheckCommand,
	'ticket-state': ticketStateCommand,
	'work-order': workOrderCommand,
	status: statusCommand,
	doctor: doctorCommand,
	report: reportCommand,
	'standards-check': standardsCheckCommand,
	'standards-validate': standardsValidateCommand,
	'standards-health': standardsHealthCommand,
	refactor: refactorCommand,
	'test-coverage-to-threshold': testCoverageToThresholdCommand,
	plan: planCommand,
	brainstorm: brainstormCommand,
	friction: frictionCommand,
	improve: improveCommand,
	voice: voiceCommand,
};

const main = async (): Promise<void> => {
	const [command, ...rest] = process.argv.slice(2);
	const flags = parseFlags({ args: rest });
	const cwd = getStringFlag({ flags, name: 'cwd' }) ?? process.cwd();

	// Before any command reads the environment, so the repository's own `.env`
	// answers for the tracker key rather than every caller having to export it.
	await loadRepoEnvFile({ cwd });

	const run = command === undefined ? undefined : commands[command];
	const problem = command === undefined || run === undefined ? undefined : getUnknownFlagsMessage({ command, flags });

	if (run && problem === undefined) {
		await run({ flags, rest, cwd });
		return;
	}

	console.error(problem === undefined ? usage : `${problem}\n\n${usage}`);
	return exitCli({ code: command === undefined || command === 'help' ? 0 : 1 });
};

await main();
