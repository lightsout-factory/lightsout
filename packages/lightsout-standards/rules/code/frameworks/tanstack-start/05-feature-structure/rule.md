---
summary: "How a feature folder grows."
checks: agent
severity: advisory
requires:
  - component-file-structure
  - index-files
  - query-options
  - server-functions
  - shared-code-placement
---

## Feature Structure

A feature is a module in `src/features/`, such as `src/features/issues/`. It grows only the folders its code needs, each made with its first file and never in advance:

- `screens/`: components a route renders.
- `queries/`: query-options factories, as `query-options` says.
- `serverFns/`: server functions, as `server-functions` says.
- `hooks/`: custom hooks, as `tanstack-hooks` says.
- `components/`: components used across the feature.
- `common/`: code shared inside the feature, placed as `shared-code-placement` says.

There is no fixed tree to stamp out: a folder made before its first file is a guess about code nobody has written.
