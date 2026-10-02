---
summary: "How the field that tells union members apart is typed and checked."
checked: true
severity: advisory
requires:
  - bare-string-union
---

## Discriminant Const Object

Type the discriminant field of a union family with the `const` object's member, not a raw literal: `kind: typeof SyncEventKind.FileAdded`, not `kind: 'file-added'`. Narrow with the member too, in `===` comparisons and `switch` cases.

```typescript
export interface FileAddedEvent {
	kind: typeof SyncEventKind.FileAdded;
	path: string;
}

if (event.kind === SyncEventKind.FileAdded) { /* ... */ }
```

A narrowing site is at fault only when there is a member to use instead:

- A union with no `const` object, such as `type Mode = 'fast' | 'slow'`, has no member. Declaring one is `bare-string-union`'s job.
- When the file cannot import the constant, because its package does not depend on the one declaring it or a build deliberately isolates its folder, the literal stands.
- `typeof value === 'string'` is not a discriminant.

A UI component's discriminated `Props` union may use raw string literals as discriminants, such as `status: 'notInstalled' | 'connected'`, because the caller writes the literal once, as a JSX attribute. When the same values also appear in domain logic, use the `const` object everywhere, props included.

TypeScript narrows on the member just as it does on the literal, and consumers no longer type the literal again at every narrowing site.
