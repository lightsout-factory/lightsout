---
summary: "How a screen's data is fetched."
checks: both
severity: advisory
requires:
  - query-options-per-query
  - thin-route-file
example:
  kind: repo
  focus:
    fail: src/issues/IssuesScreen/IssuesScreen.tsx
    pass: src/routes/issues.tsx
---

## Loader Owns First Paint

Fetch what a screen shows on its first render in the route loader, with `ensureQueryData` on the screen's query options, and read it in the screen with `useSuspenseQuery` on the same object. The screen then has no loading branch for that data.

Never wrap a query in a hook that only calls it: a `useIssues` whose body is `useQuery(issuesQueryOptions())` is a second name for the same thing. Call the query where it is used, and write a hook only when it holds logic of its own.

Data a screen needs later, after an interaction or below the fold, is fetched where it is needed with `useQuery`.

Then a route is complete when its loader resolves, and a reader finds the fetch in two places that name one object.
