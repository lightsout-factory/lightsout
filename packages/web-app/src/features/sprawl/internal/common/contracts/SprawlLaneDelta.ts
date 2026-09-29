import { z } from 'zod';
import { SprawlFile } from '#src/features/sprawl/internal/common/contracts/SprawlFile.ts';
import { SprawlFolder } from '#src/features/sprawl/internal/common/contracts/SprawlFolder.ts';

/** A change against the previous frame: a full snapshot per frame would ship megabytes to the homepage. */
export const SprawlLaneDelta = z.object({
	/** Files whose line count changed since the previous frame, plus new files; removals travel out-of-band (see `removedFiles`). The first frame carries every file. */
	files: z.array(SprawlFile),
	/** Folders whose direct-entry count changed; removals travel out-of-band (see `removedFolders`). The first frame carries every folder. */
	folders: z.array(SprawlFolder),
	/** Paths present in the previous frame's state and gone from this one. Never overlaps `files`. Empty on the first frame. */
	removedFiles: z.array(z.string()),
	/** Folder paths present in the previous frame's state and gone from this one. Never overlaps `folders`. Empty on the first frame. */
	removedFolders: z.array(z.string()),
	/** Files over the file cap in this lane at this frame — counted on the full state, not the delta. */
	overCap: z.number(),
});

export type SprawlLaneDelta = z.infer<typeof SprawlLaneDelta>;
