import { printStandardsHealth } from '#src/cli/standards/standardsHealthCommand/printStandardsHealth.ts';
import { readOptionalConfig } from '#src/common/config/readOptionalConfig.ts';
import { exitCli } from '#src/common/exitCli.ts';
import type { CommandContext } from '#src/common/types/CommandContext.ts';
import { resolveStandardsGroups } from '#src/standards/resolveStandardsGroups/resolveStandardsGroups.ts';
import { buildStandardsHealth } from '#src/standardsCheck/buildStandardsHealth.ts';

// Always exits 0: it reports on the rules, not the code, so there is nothing to gate on.
export const standardsHealthCommand = async ({ cwd }: CommandContext): Promise<void> => {
	const config = await readOptionalConfig({ cwd });
	const groups = await resolveStandardsGroups({ cwd, config });
	const health = await buildStandardsHealth({ cwd, groups });

	printStandardsHealth({ health });
	return exitCli({ code: 0 });
};
