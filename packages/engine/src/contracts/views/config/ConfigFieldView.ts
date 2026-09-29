import { z } from 'zod';

export const ConfigFieldView = z.object({
	/** The config key as written in the file, e.g. 'package-gates'. */
	key: z.string(),
	/** The resolved value, JSON-serialisable; null when the key is unset and lightsout applies no named default. */
	value: z.json(),
	/** True when `lightsout.config.json` set it; false when this is lightsout's default. */
	fromConfig: z.boolean(),
	/** The schema's own doc comment for this key, so the page and the contract cannot disagree. */
	description: z.string(),
});

export type ConfigFieldView = z.infer<typeof ConfigFieldView>;
