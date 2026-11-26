import { z } from 'zod';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { ShippingStepId } from '#src/contracts/ship/ShippingStepId.ts';
import { ShipResult } from '#src/contracts/ship/ShipResult.ts';
import { WorkOrderSummary } from '#src/contracts/views/workOrder/WorkOrderSummary.ts';
import { PlanId } from '#src/contracts/workOrder/PlanId.ts';
import { PlanProgress } from '#src/contracts/workOrder/PlanProgress.ts';
import { WorkOrderEventKind } from '#src/contracts/workOrder/WorkOrderEventKind.ts';
import { WorkOrderMode } from '#src/contracts/workOrder/WorkOrderMode.ts';

/** One work order's page: its row in the list, and the record and ship records behind it. */
export const WorkOrderView = z.object({
	summary: WorkOrderSummary,
	mode: z.enum(WorkOrderMode),
	/** Every plan the record holds, in record order, excluded ones included. */
	plans: z.array(
		z.object({
			id: PlanId,
			title: z.string(),
			progress: z.enum(PlanProgress),
			/** The decision that took the plan out of the work order's work. */
			exclusion: z.object({ at: z.string(), reason: z.string() }).optional(),
		}),
	),
	/** `isPlanlessWorkOrder` answered true. */
	builtFromTicketBody: z.boolean(),
	/** The latest build from the ticket body, when the work order is built from it. */
	ticketBodyBuild: z.object({ progress: z.enum(PlanProgress), startedAt: z.string(), finishedAt: z.string().optional() }).optional(),
	/** What happened the last time the branch was shipped. */
	shipResult: ShipResult.optional(),
	/** One row per `ShippingStepId` in key order; empty when no ship-progress record is on disk. */
	shipSteps: z.array(z.object({ id: z.enum(ShippingStepId), status: z.enum(RunStatus).optional(), durationMs: z.number().optional() })),
	/** A ship of the branch is going under a live process right now. */
	shipLive: z.boolean(),
	/** The record's history, in recorded order. */
	history: z.array(z.object({ at: z.string(), kind: z.enum(WorkOrderEventKind), detail: z.string() })),
});

export type WorkOrderView = z.infer<typeof WorkOrderView>;
