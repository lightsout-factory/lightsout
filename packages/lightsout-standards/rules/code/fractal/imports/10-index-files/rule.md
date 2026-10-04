---
summary: "Which folders have an index file, and where an import points."
checks: deterministic
severity: advisory
example:
  kind: repo
  focus:
    fail: src/reporting/buildReport.ts
    pass: src/reporting/buildReport.ts
---

## Index Files

Only a package's entry is an index file, and nothing inside the package imports through it. Every import names the file that declares what it imports: `@/ingestion/ingestRecords`, never `@/ingestion`.

- Delete an index file in any other folder, and import each name from the file that declares it.
- Import from another package through its entry, such as `@acme/engine`, never by a path into its `src/`.
- An index file may re-export from another index file, and its own test imports it.

An import through an index file loads every file it re-exports to reach one name, and a test runner, unlike a bundler, pays for all of them.
