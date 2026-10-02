---
summary: "Functions and files that add nothing but a second name."
checked: partial
severity: advisory
example:
  kind: repo
  focus:
    fail: src/common/utils/buildBrowserLabel.ts
    pass: src/browsers/getBrowserBadge.ts
---

## No Thin Wrappers

Never write a function that only renames parameters or passes the call on to another function. Call the underlying function directly.

```typescript
// Incorrect: adds nothing but a second name
export const buildBrowserLabel = ({ browser, browserVersion }) =>
	buildVersionedLabel({ name: browser, version: browserVersion });
```

- A wrapper is justified when it adds real validation or transformation, meaningfully simplifies a complex API, or handles errors or defaults.
- A class that holds a collaborator instead of extending it reaches it through one-line methods that pass each call on unchanged. Those are not thin wrappers: deleting them would publish the held value, and callers could then step around a sibling method that adds a timer, a counter or a progress line to the same call.
- That exception covers only a class passing calls to something it holds. A free function that only passes the call on to another free function is still a thin wrapper.

Never create a file only to give another type a new name, such as `export type FilterOptions = TableFilterState`. Use the original type directly. When the difference in meaning matters, say so in a comment where the type is used.

A wrapper that adds nothing is one more name to follow before reaching the code that does the work, and a comment states a difference in meaning without sending every reader through one more file.
