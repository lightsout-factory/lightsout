---
summary: "How a set of named string values is declared, and how the field that tells union members apart is typed and checked."
checked: true
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
	List: 'list',
	Update: 'update',
} as const;

export type Action = (typeof Action)[keyof typeof Action];
```

```typescript
doThing(Action.Add);
```

Name the object in PascalCase, because it shares its name with its type. Every other constant is camelCase: a single value such as `maxRetries`, or an object that groups related values such as `featureThresholds`.

A lookup map keyed by the union, `Record<Action, string>`, has an entry for every member and may share the object's file, because a change to one always changes the other. A constant that only uses the union, such as a default value or a subset of members, gets its own file.

Type the discriminant field of a union family with the `const` object's member, not a raw literal: `kind: typeof SyncEventKind.FileAdded`, not `kind: 'file-added'`. Narrow with the member too, in `===` comparisons and `switch` cases.

```typescript
export interface FileAddedEvent {
	kind: typeof SyncEventKind.FileAdded;
	path: string;
}

if (event.kind === SyncEventKind.FileAdded) { /* ... */ }
```

A narrowing site is at fault only when there is a member to use instead:

- A union with no `const` object, such as `type Mode = 'fast' | 'slow'`, has no member yet. Declare the object first, as above.
- When the file cannot import the constant, because its package does not depend on the one declaring it or a build deliberately isolates its folder, the literal stands.
- `typeof value === 'string'` is not a discriminant.

A UI component's discriminated `Props` union may use raw string literals as discriminants, such as `status: 'notInstalled' | 'connected'`, because the caller writes the literal once, as a JSX attribute. When the same values also appear in domain logic, use the `const` object everywhere, props included.

With a bare union, every call site types the raw string again, so the values are defined everywhere. TypeScript narrows on the member just as it does on the literal, and consumers no longer type the literal again at every narrowing site.
