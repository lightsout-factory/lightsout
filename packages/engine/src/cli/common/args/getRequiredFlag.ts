import { usage } from '#src/common/constants/usage.ts';
import { exitCli } from '#src/common/exitCli.ts';
import { getStringFlag } from '#src/common/getStringFlag.ts';

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
