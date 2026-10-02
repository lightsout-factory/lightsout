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

Name the object in PascalCase, because it shares its name with its type. Every other constant is camelCase: a single value such as `maxRetries`, or an object that groups related values such as `featureThresholds`.

A lookup map keyed by the union, `Record<Action, string>`, has an entry for every member and may share the object's file, because a change to one always changes the other. A constant that only uses the union, such as a default value or a subset of members, gets its own file.

With a bare union, every call site types the raw string again, so the values are defined everywhere.
