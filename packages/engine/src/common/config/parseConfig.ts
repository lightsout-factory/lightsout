import { z } from 'zod';
import { messageOf } from '#src/common/utils/messageOf.ts';
import { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';

interface Params {
	raw: string;
	configPath: string;
}

/** Zod's own `message` is a JSON dump of its issue array, which buries the schema's sentences in punctuation. */
const describeIssues = ({ error, configPath }: { error: z.ZodError; configPath: string }) => {
	const lines = error.issues.map((issue) => {
		const where = issue.path.join('.');

		return `  ${where === '' ? '' : `${where}: `}${issue.message}`;
	});

	return [`lightsout.config.json at ${configPath} is not valid:`, ...lines].join('\n');
};

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

		throw error instanceof z.ZodError ? new Error(describeIssues({ error, configPath })) : error;
	}
};
