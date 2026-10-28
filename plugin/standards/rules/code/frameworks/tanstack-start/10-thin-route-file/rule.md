---
summary: "What a route file holds."
checks: agent
severity: advisory
requires:
  - feature-layout
example:
  kind: repo
  focus:
    fail: src/routes/issues.$issueId.tsx
    pass: src/routes/issues.$issueId.tsx
---

## Thin Route File

A route file holds route wiring and nothing else: the loader, `beforeLoad` guards, `validateSearch`, `head`, and the one `Screen` it renders, imported from a feature's top level. Read params and search through the route's own hooks, `Route.useParams()` and `Route.useSearch()`, never the untyped ones.

A component written in the route file may only turn params into the screen's props. Markup, state, a fetch, and anything that deserves a test of its own belong in the screen.

A route file is named by its URL, so nobody searching for a name finds the code in it.
