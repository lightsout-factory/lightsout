import { z } from 'zod';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';

/** Nothing here may require opening a JSONL file, so listing every run stays cheap however long the history gets. */
export const RunListing = z.object({
	runId: z.string(),
	/** First eight characters — the form every lightsout report prints and `resume --run` accepts. */
	shortId: z.string(),
	/** One of `PipelineKind`; a manifest predating the discriminator reads as `PipelineKind.Implement`. Kept a string so a row survives a value this engine does not know. */
	pipeline: z.string(),
	status: z.enum(RunStatus),
	title: z.string(),
	/** Repo-relative plan path, exactly as the manifest records it. */
	plan: z.string(),
	planName: z.string().optional(),
	createdAt: z.string(),
	updatedAt: z.string(),
	/** A live process stands behind this run right now. */
	live: z.boolean(),
	packages: z.array(z.string()),
	stepsPassed: z.number(),
	stepCount: z.number(),
	changedFileCount: z.number(),
	/** Run-wide API-equivalent cost; absent for drivers that report no usage. */
	costUsd: z.number().optional(),
	/** Set on a phase's child run: the coordinator that started it. */
	parentRunId: z.string().optional(),
	/** A `resume --run` would do something: failed, either paused state, or running with no live process. */
	resumable: z.boolean(),
});

export type RunListing = z.infer<typeof RunListing>;
