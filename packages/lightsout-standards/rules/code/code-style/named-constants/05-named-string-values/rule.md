---
summary: "How a set of named string values is declared and used."
checks: deterministic
severity: advisory
example:
  kind: repo
  focus:
    fail: src/common/types/SyncEvent.ts
    pass: src/common/types/SyncEvent.ts
---

## Named String Values

Declare a set of named string values as a `const` object, and derive the union type from it, so the object is the single source of truth. Consumers reference the object's members, such as `Action.Add`, never raw string literals.

```typescript
// common/constants/Action.ts
export const Action = {
	Add: 'add',
	Remove: 'remove',
} as const;

export type Action = (typeof Action)[keyof typeof Action];
```

A lookup map keyed by the union, `Record<Action, string>`, may share the object's file, because a change to one always changes the other. A constant that only uses the union, such as a default value or a subset of members, gets its own file.

Type the discriminant field of a union family with the object's member, and narrow with the member too, in `===` comparisons and `switch` cases:

```typescript
export interface FileAddedEvent {
	kind: typeof SyncEventKind.FileAdded;
	path: string;
}

if (event.kind === SyncEventKind.FileAdded) { /* ... */ }
```

A raw literal stands only where there is no member to use:

- A union with no `const` object yet, such as `type Mode = 'fast' | 'slow'`. Declare the object first.
- A file that cannot import the constant, because its package does not depend on the one declaring it or a build deliberately isolates its folder.

With a bare union, every call site types the raw string again, so the values are defined everywhere.
