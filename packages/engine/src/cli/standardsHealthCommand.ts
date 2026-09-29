import type { CommandContext } from '#src/cli/common/types/CommandContext.ts';
import { exitCli } from '#src/cli/common/utils/exitCli.ts';
import { printStandardsHealth } from '#src/cli/internal/common/render/printStandardsHealth.ts';
import { readOptionalConfig } from '#src/common/config/readOptionalConfig.ts';
import { buildStandardsHealth } from '#src/standardsCheck/buildStandardsHealth.ts';
import { resolveStandardsPacks } from '#src/standardsPacks/resolveStandardsPacks.ts';

// Always exits 0: it reports on the rules, not the code, so there is nothing to gate on.
export const standardsHealthCommand = async ({ cwd }: CommandContext): Promise<void> => {
	const config = await readOptionalConfig({ cwd });
	const packs = await resolveStandardsPacks({ cwd, config });
	const health = await buildStandardsHealth({ cwd, packs });

	printStandardsHealth({ health });
	return exitCli({ code: 0 });
};
