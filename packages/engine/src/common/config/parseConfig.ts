import { z } from 'zod';
import { describeConfigIssues } from '#src/common/config/describeConfigIssues.ts';
import { messageOf } from '#src/common/utils/messageOf.ts';
import { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';

interface Params {
	raw: string;
	configPath: string;
}

/**
 * A syntax error stays a `SyntaxError`: an unparseable file is a typo, an
 * invalid one is a config that means something the engine will not do.
 */
export const parseConfig = ({ raw, configPath }: Params): LightsoutConfig => {
	try {
		return LightsoutConfig.parse(JSON.parse(raw));
	} catch (error) {
		if (error instanceof SyntaxError) {
			throw new SyntaxError(`lightsout.config.json at ${configPath} is not valid JSON — ${messageOf({ error })}`);
		}

		throw error instanceof z.ZodError
			? new Error([`lightsout.config.json at ${configPath} is not valid:`, ...describeConfigIssues({ error })].join('\n'))
			: error;
	}
};
