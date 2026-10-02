---
summary: "Functions that only pass a call on to another."
checked: false
severity: advisory
---

## Thin Wrapper Functions

Never write a function that only renames parameters or passes the call on to another function. Call the underlying function directly.

```typescript
// Incorrect: adds nothing but a second name
export const buildBrowserLabel = ({ browser, browserVersion }) =>
	buildVersionedLabel({ name: browser, version: browserVersion });
```

- A wrapper is justified when it adds real validation or transformation, meaningfully simplifies a complex API, or handles errors or defaults.
- A class that holds a collaborator instead of extending it, as `class-inheritance` requires, reaches it through one-line methods that pass each call on unchanged. Those are not thin wrappers: deleting them would publish the held value, and callers could then step around a sibling method that adds a timer, a counter or a progress line to the same call.
- That exception covers only a class passing calls to something it holds. A free function that only passes the call on to another free function is still a thin wrapper.

A wrapper that adds nothing is one more name to follow before reaching the code that does the work.
