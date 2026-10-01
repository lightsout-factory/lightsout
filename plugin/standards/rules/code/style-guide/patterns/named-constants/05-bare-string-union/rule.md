---
summary: "How a set of named string values is declared."
checked: true
severity: advisory
---

## Bare String Union

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

With a bare union, every call site types the raw string again, so the values are defined everywhere.
