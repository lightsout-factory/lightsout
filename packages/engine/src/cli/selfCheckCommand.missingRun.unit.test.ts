import { describe, expect, jest, test } from '@jest/globals';
import { parseFlags } from '#src/cli/common/parseFlags.ts';
import { selfCheckCommand } from '#src/cli/selfCheckCommand.ts';
import type { CommandContext } from '#src/common/types/CommandContext.ts';
import { captureCommandOutput } from '#tests/helpers/captureCommandOutput.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';

// Mocked Imports
// -------------------------
// The gate run is the gates module's own entry point, covered by its own tests.
// What this file pins is that a run id naming no run stops the command before
// any gate runs, so the stand-in only records whether it was reached. The
// command file is imported directly rather than through the CLI barrel, which
// would read this stubbed gates module from every other command it re-exports.
const mockRunSelfCheck = jest.fn<(params: unknown) => Promise<unknown>>();

jest.mock('#src/gates/runSelfCheck/runSelfCheck.ts', () => ({ runSelfCheck: (params: unknown) => mockRunSelfCheck(params) }));
// -------------------------

/** A repo holding no runs at all, and a context naming a run id nothing on disk answers to. */
const setupMissingRun = () => {
	const captured = captureCommandOutput();
	const cwd = setupConsumerRepo();
	const context: CommandContext = { flags: parseFlags({ args: ['--run', 'run-gone'] }), rest: [], cwd };

	return { context, ...captured };
};

describe('selfCheckCommand', () => {
	test('selfCheckCommand: says in one line that a run id names no run on disk, and exits 1 without running a gate', async () => {
		const { context, errors, logged, exitCodes } = setupMissingRun();

		await expect(selfCheckCommand(context)).rejects.toThrow(/process\.exit/);

		// a stack trace in the agent's shell would spend one of its three rounds on
		// the tool rather than on the code
		expect(mockRunSelfCheck).not.toHaveBeenCalled();
		expect(exitCodes).toStrictEqual([1]);
		expect(errors.join('\n')).toContain("no run matching 'run-gone'");
		expect(logged).toStrictEqual([]);
	});
});
