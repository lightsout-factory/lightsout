import { z } from 'zod';
import { FrictionRecord } from '#src/contracts/friction/FrictionRecord.ts';
import { RunUsage } from '#src/contracts/run/RunUsage.ts';
import { AgentInvocation } from '#src/contracts/views/AgentInvocation.ts';
import { GateEvidence } from '#src/contracts/views/GateEvidence.ts';
import { RunListing } from '#src/contracts/views/RunListing.ts';
import { RunStepView } from '#src/contracts/views/RunStepView.ts';
import { RunBurnDown } from '#src/contracts/views/runBurnDown/RunBurnDown.ts';

export const RunView = z.object({
	listing: RunListing,
	harness: z.string(),
	/**
	 * Overview plan path, repo-relative. The coordinator's manifest carries no
	 * `overview` field, so on the coordinator this is its `manifest.plan`.
	 */
	overview: z.string().optional(),
	currentStep: z.string().nullable(),
	/** Wall clock across the run, including idle gaps between a failure and its resume. */
	wallMs: z.number(),
	/** Sum of step durations — actual working time. */
	activeMs: z.number(),
	gateMs: z.number(),
	usage: RunUsage.optional(),
	/** Share of all input the model read from cache. */
	cacheReadShare: z.number().optional(),
	steps: z.array(RunStepView),
	gates: z.array(GateEvidence),
	gateTotals: z.object({ commands: z.number(), reruns: z.number(), skipped: z.number() }),
	agents: z.array(AgentInvocation),
	/** Final messages that failed their contract and cost a re-emit retry. */
	rejectedReports: z.number(),
	friction: z.array(FrictionRecord),
	changedFiles: z.array(z.string()),
	unreachableChangedFiles: z.array(z.string()),
	/** Set on a phase's child run: the coordinator that spawned it. */
	parent: z.object({ runId: z.string(), step: z.string(), title: z.string() }).optional(),
	/** What a refactor or coverage run burned down; absent on implement and phases runs, which burn nothing down. */
	burnDown: RunBurnDown.optional(),
});

export type RunView = z.infer<typeof RunView>;
