---
summary: "How many things one file may export."
checks: deterministic
severity: advisory
---

## Multi-Export

Give each exported function, class, interface, type or constant its own file, named after the export. Non-exported items, such as private helpers and local types, may sit in the file of the export they serve.

Only these cases may put more than one item in a file:

1. A `Params` interface stays in its function's file, not exported.
2. A private helper stays in the file of the export it serves, not exported, while only that file calls it. When covering it through the export is impractical, because its inputs are combinatorial, give it its own file and its own tests.
3. A union and its member types share one file when the members exist only as parts of that union.
4. A lookup map keyed by a union (`Record<MyType, …>`) may sit in the file that declares the union: a change to one always changes the other.
5. A type and the single value typed by it share one file, named for the value, such as `interface Config` beside `export const defaultConfig: Config`: the value has no consumer the type lacks.

"Closely related", "both config functions", "over-engineered to split", "just a small helper" and "one is a helper for the other" are not exceptions. Make a helper non-exported and keep it in the file, or give each export its own file: `loadConfig` and `saveConfig` go in `loadConfig.ts` and `saveConfig.ts`.

Exception 3:

```typescript
// common/types/SyncEvent.ts
export interface FileAddedEvent {
	kind: typeof SyncEventKind.FileAdded;
	path: string;
}

export interface RecordParsedEvent {
	kind: typeof SyncEventKind.RecordParsed;
	recordId: string;
}

export type SyncEvent = FileAddedEvent | RecordParsedEvent;
```

When a member type starts being used on its own, it moves to its own file.

When several values form one concept, such as a feature's thresholds, export one named object: `export const featureThresholds = { maxBatchSize: 20, maxRetries: 3 } as const;`. Never a bag, such as a `constants.ts` of loose exports.

One export per file gives each item one name at every use, and a search finds it.
