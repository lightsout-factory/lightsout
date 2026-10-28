---
summary: "Where a query is declared, and where its key lives."
checks: both
severity: advisory
requires:
  - feature-layout
example:
  kind: repo
  focus:
    fail: src/issues/IssuesScreen/IssuesScreen.tsx
    pass: src/issues/issuesQueryOptions.ts
---

## Query Options Per Query

Declare every query once, as a `queryOptions()` factory in a file of its own named with a `QueryOptions` suffix, and give it its key there. A route loader, a screen and a mutation's invalidation all read that one object. None writes a `queryKey` of its own, and no file collects the keys of several queries.

Leave the factory's return type to inference, as `inferred-return-types` says.

A key written once is found, invalidated and changed from that one place. A key spelled in two places drifts, and a shared list of keys is a file every feature has to edit.
