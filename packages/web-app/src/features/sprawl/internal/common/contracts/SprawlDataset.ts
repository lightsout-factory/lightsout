import { z } from 'zod';
import { SprawlFrame } from '#src/features/sprawl/internal/common/contracts/SprawlFrame.ts';

/** Built by `scripts/buildSprawlDataset.mjs` and committed to `assets/sprawl-dataset.json`. */
export const SprawlDataset = z.object({
	/** The commit the dataset was built at — the last frame's sha, so a rebuild at the same HEAD is byte-identical. */
	headSha: z.string(),
	caps: z.object({ file: z.number(), tsxFile: z.number(), function: z.number(), testFile: z.number(), folderCensus: z.number() }),
	/** How many commits the 400-frame cap dropped; 0 normally. */
	droppedCommits: z.number(),
	frames: z.array(SprawlFrame),
});

export type SprawlDataset = z.infer<typeof SprawlDataset>;
