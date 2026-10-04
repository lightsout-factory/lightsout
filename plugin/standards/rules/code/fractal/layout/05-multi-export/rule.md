---
summary: "How many things one file may export."
checks: deterministic
severity: advisory
---

## Multi-Export

Export one thing per file, and name the file after it: `loadConfig` and `saveConfig` go in `loadConfig.ts` and `saveConfig.ts`.

- A helper or a `Params` interface that only this file uses stays in it, not exported.
- When covering a helper through the export is impractical, because its inputs are combinatorial, give it its own file and its own tests.
- A type or constant that another file needs gets its own file.

Only these files may export more than one thing:

1. A union type and its member types, while the members are used only as parts of that union. When a member starts being used on its own, it moves to its own file.
2. A constant object and the type derived from it, under one name.

```typescript
// common/types/SyncEvent.ts
export interface FileAddedEvent {
	kind: 'file-added';
	path: string;
}

export interface RecordParsedEvent {
	kind: 'record-parsed';
	recordId: string;
}

export type SyncEvent = FileAddedEvent | RecordParsedEvent;
```

```typescript
// common/constants/SyncState.ts
export const SyncState = { idle: 'idle', busy: 'busy' } as const;

export type SyncState = (typeof SyncState)[keyof typeof SyncState];
```

When several values form one concept, such as a feature's thresholds, export one named object: `export const featureThresholds = { maxBatchSize: 20, maxRetries: 3 } as const;`. Never a file of loose constants.

One export per file gives each item one name at every use, and a search finds it.
