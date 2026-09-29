/**
 * `SinglePlan`: plan 001 alone supplies the implementation and automatic
 * shipping applies. `MultiplePlan`: plans implement in numeric order on one
 * branch and ship only on an explicit ship request naming them.
 *
 * Seeded from `plan.default-work-order-mode`, except that the queue creates the
 * records it builds from a ticket body in single-plan mode.
 */
export const WorkOrderMode = {
	SinglePlan: 'single-plan',
	MultiplePlan: 'multiple-plan',
} as const;

export type WorkOrderMode = (typeof WorkOrderMode)[keyof typeof WorkOrderMode];
