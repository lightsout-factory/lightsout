---
summary: "How a screen test is set up."
checks: agent
severity: advisory
requires:
  - no-route-file-tests
  - component-test-rendering
example:
  kind: snippet
---

## Screen Test Under Router

Render a screen inside a memory-history router whose one route renders it, with a query client seeded with what its loader would have fetched: `queryClient.setQueryData(issuesQueryOptions().queryKey, issues)`. Never mock the router's hooks or the query hooks.

A screen rendered free of its router and query client is not the one the route renders. Under them it is, which is why the route itself gets no test.
