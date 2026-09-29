import { z } from 'zod';
import { FixtureSide } from '#src/contracts/views/FixtureSide.ts';

export const StandardsPackFixture = z.object({
	side: z.enum(FixtureSide),
	/** Path relative to that side's root, e.g. 'src/payloads/readLabel.ts'. */
	path: z.string(),
	text: z.string(),
});

export type StandardsPackFixture = z.infer<typeof StandardsPackFixture>;
