import { z } from 'zod';
import { WorkOrderMode } from '#src/contracts/workOrder/WorkOrderMode.ts';

/**
 * `.strict()` so a typo in an opt-in switch fails loudly rather than silently
 * leaving the feature off.
 */
export const ConfigPlan = z
	.object({
		/** When true the writer produces the contract shape with an acceptance-test ledger, the lint requires the ledger section, and the grade weighs each plan file and spawns readers only for heavy ones. Default false. */
		contract: z.boolean().optional(),
		/** The mode a work order's own record is created with: `single-plan`, where plan 001 alone supplies the work order's implementation, or `multiple-plan`, where the work order's plans implement in numeric order on one branch. Default `single-plan`. Read only when a record is created, so changing it never rewrites a work order that already has one. The queue creates the record of a ticket it builds from the ticket body in `single-plan` mode whatever this key says. */
		'default-work-order-mode': z.enum(WorkOrderMode).optional(),
		/** Whether a planning session works in its own isolated git worktree rather than the checkout it was launched from. Default true. `--worktree` and `--no-worktree` override it for one command. */
		worktree: z.boolean().optional(),
		/** The counts above which a plan file is heavy. Each key optional; see `defaultWeightThresholds`. */
		'weight-thresholds': z
			.object({
				/** A file creating more source files than this is heavy. Default 3. */
				'created-files': z.number().int().min(0).optional(),
				/** A file touching more packages than this is heavy. Default 1. */
				packages: z.number().int().min(1).optional(),
			})
			.strict()
			.optional(),
	})
	.strict();

export type ConfigPlan = z.infer<typeof ConfigPlan>;
