/** Keyed by `getNameKey`, so one lookup answers "is there an existing export that is this concept". */
export type ExportCensus = Map<string, Array<{ name: string; path: string }>>;
