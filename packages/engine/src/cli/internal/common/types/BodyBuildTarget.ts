/**
 * What a build from the ticket body is recorded against: single-plan plan 001
 * by its plan address, or a work order holding no plan 001 by its name.
 */
export type BodyBuildTarget = { planName: string } | { workOrderName: string };
