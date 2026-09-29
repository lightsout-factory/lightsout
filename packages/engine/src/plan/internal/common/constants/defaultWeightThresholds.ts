/** Used when `plan.weight-thresholds` leaves them unset; a plan file is heavy strictly above these counts. */
export const defaultWeightThresholds = { createdFiles: 3, packages: 1 } as const;
