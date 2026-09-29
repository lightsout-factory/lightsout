/**
 * Counts created files, not touched ones, because a created file is what a plan
 * has to specify in full: a mechanical hundred-file rename must stay legal as
 * one phase, a fifty-file authoring phase must not.
 */
export const createdFileCeiling = 30;
