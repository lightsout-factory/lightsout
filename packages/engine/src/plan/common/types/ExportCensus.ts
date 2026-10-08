/** Keyed by `getNameKey`, so one lookup answers "does the repo already declare a name for this concept". */
export type ExportCensus = Map<string, Array<{ name: string; path: string }>>;
