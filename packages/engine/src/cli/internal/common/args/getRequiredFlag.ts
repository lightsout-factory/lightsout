import { getStringFlag } from '#src/cli/common/args/getStringFlag.ts';
import { usage } from '#src/cli/common/constants/usage.ts';
import { exitCli } from '#src/cli/common/utils/exitCli.ts';

interface Params {
	flags: Map<string, string | true>;
	name: string;
}

/** Async because the exit drains the stdio pipes first (see exitCli). */
export const getRequiredFlag = async ({ flags, name }: Params): Promise<string> => {
	const value = getStringFlag({ flags, name });

	if (!value) {
		console.error(usage);
		return exitCli({ code: 1 });
	}

	return value;
};
