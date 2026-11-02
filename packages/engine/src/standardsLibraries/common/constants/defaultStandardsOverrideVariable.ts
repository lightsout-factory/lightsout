/**
 * A development override, set by this repo's own suites: the walk in
 * `resolveDefaultStandardsLibrary` only finds the built copy, so without it
 * every test touching the default would pass or fail on whether someone had run
 * `pnpm bundle`.
 */
export const defaultStandardsOverrideVariable = 'LIGHTSOUT_DEFAULT_STANDARDS';
