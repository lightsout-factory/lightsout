import { z } from 'zod';
import { GradeFindingStatus } from '#src/contracts/plan/memory/GradeFindingStatus.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { ShippingStepId } from '#src/contracts/ship/ShippingStepId.ts';
import { ShipStatus } from '#src/contracts/ship/ShipStatus.ts';
import { EvidenceCount } from '#src/contracts/views/planEvidence/EvidenceCount.ts';
import { EvidenceHeadline } from '#src/contracts/views/planEvidence/EvidenceHeadline.ts';
import { EvidenceProvenance } from '#src/contracts/views/planEvidence/EvidenceProvenance.ts';
import { EvidenceSectionState } from '#src/contracts/views/planEvidence/EvidenceSectionState.ts';

/**
 * Composed as a view over the records each step writes when it happens, so it fills in as
 * the plan is planned and built. Each section is optional, and an absent section means its
 * step never ran; `problems` names each record that exists but would not read, so it never
 * reads as absent.
 */
export const PlanEvidence = z.object({
	/** The plan address, `<work-order>/<plan-id>`. */
	name: z.string(),
	/** `WorkOrderPlan.implementation.runId`; absent before the plan was built. */
	buildRunId: z.string().optional(),
	/** The build run's own status, stated at the top of every display. */
	runStatus: z.enum(RunStatus).optional(),
	headline: EvidenceHeadline,
	/** Lines every commit of the build family added and removed, once per sha; absent when none was measured. Measured. */
	lines: z.object({ added: EvidenceCount, removed: EvidenceCount }).optional(),
	plan: z
		.object({
			state: z.enum(EvidenceSectionState),
			gradePasses: z.array(
				z.object({ gradedAt: z.string(), grade: z.string(), gaps: EvidenceCount, structural: EvidenceCount, provenance: z.enum(EvidenceProvenance) }),
			),
			findingsByStatus: z.array(z.object({ status: z.enum(GradeFindingStatus), count: EvidenceCount })),
			questionsAsked: EvidenceCount.optional(),
			answeredWithoutUser: EvidenceCount.optional(),
			pathsChecked: EvidenceCount.optional(),
			pathsMissing: EvidenceCount.optional(),
			scriptsChecked: EvidenceCount.optional(),
			scriptsMissing: EvidenceCount.optional(),
		})
		.optional(),
	tests: z
		.object({
			state: z.enum(EvidenceSectionState),
			/** Present only when a family manifest records at least one acceptance test. */
			acceptanceTests: EvidenceCount.optional(),
			/** Both absent when no family run holds a test-review record. */
			reviewedFiles: EvidenceCount.optional(),
			rejections: EvidenceCount.optional(),
			/** Present only when the family's first and last recorded steps share a gate execution that answered tests at both. */
			testCount: z.object({ before: EvidenceCount, after: EvidenceCount }).optional(),
		})
		.optional(),
	checks: z
		.object({
			state: z.enum(EvidenceSectionState),
			gateRuns: EvidenceCount,
			failed: EvidenceCount,
			fixed: EvidenceCount,
			selfChecks: EvidenceCount,
			repairs: z.array(z.object({ gateFamily: z.string(), attempts: EvidenceCount })),
		})
		.optional(),
	cleanup: z
		.object({
			state: z.enum(EvidenceSectionState),
			/** The cleanup step's own figures; absent when no family run holds a cleanup record, which is how a cleanup that never ran differs from one that found nothing. */
			standards: z
				.object({
					/** `InProgress` until every cleanup record read carries an `endReason`. */
					state: z.enum(EvidenceSectionState),
					/** Absent when every cleanup record predates `targeted`. */
					found: EvidenceCount.optional(),
					fixed: z.array(z.object({ rule: z.string(), files: z.array(z.string()), provenance: z.enum(EvidenceProvenance) })),
					remaining: z.array(z.object({ rule: z.string(), files: z.array(z.string()), provenance: z.enum(EvidenceProvenance) })),
					carried: EvidenceCount,
					reviewFindings: EvidenceCount,
				})
				.optional(),
			searches: z.array(z.object({ symbol: z.string(), searches: z.array(z.string()), matches: z.array(z.string()), provenance: z.enum(EvidenceProvenance) })),
			/** `dedup.json` findings; present only when there is at least one. */
			duplicates: EvidenceCount.optional(),
		})
		.optional(),
	agents: z
		.object({
			state: z.enum(EvidenceSectionState),
			processes: EvidenceCount,
			peakProcesses: EvidenceCount,
			/** Build agent invocations per pipeline step, from the family's run summaries; empty before the plan was built. */
			byStep: z.array(z.object({ step: z.string(), invocations: EvidenceCount })),
			/** One entry per command run in the plan's activity record, in recorded order. */
			timeline: z.array(
				z.object({
					label: z.string(),
					startedAt: z.string(),
					endedAt: z.string().optional(),
					outcome: z.enum(RunStatus).optional(),
					processes: EvidenceCount,
					provenance: z.enum(EvidenceProvenance),
				}),
			),
			/** Friction entries of kind decision the plan's build runs recorded, in recorded order. */
			judgementCalls: z.array(z.object({ step: z.string(), detail: z.string(), provenance: z.enum(EvidenceProvenance) })),
		})
		.optional(),
	ship: z
		.object({
			state: z.enum(EvidenceSectionState),
			result: z
				.object({
					status: z.enum(ShipStatus),
					prUrl: z.string().optional(),
					mergedAt: z.string().optional(),
					failingChecks: z.array(z.string()),
					provenance: z.enum(EvidenceProvenance),
				})
				.optional(),
			steps: z.array(
				z.object({
					id: z.enum(ShippingStepId),
					status: z.enum(RunStatus).optional(),
					durationMs: z.number().optional(),
					provenance: z.enum(EvidenceProvenance),
				}),
			),
		})
		.optional(),
	/** One line per evidence record that exists but could not be read. Planning-workspace problems are not repeated here: the plan page already lists them. */
	problems: z.array(z.string()).default([]),
});

export type PlanEvidence = z.infer<typeof PlanEvidence>;
