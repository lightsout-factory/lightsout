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

Only a package's entry is an index file, and nothing imports through one. Every import names the file that declares what it imports: `@/ingestion/ingestRecords`, never `@/ingestion`.

- Delete an index file in any other folder, and import each name from the file that declares it.
- Import from another workspace package through its entry, such as `@acme/engine`, never a path into its `src/`.
- Code inside a package never imports its own entry.
- An index file may re-export from another index file, and an index file's own test imports the file it tests.
- This rule judges only files that belong to a package. Where the repo's manifests declare workspace packages, a file outside all of them, such as a build script at the repo root, is not held to it. A repo that declares none is one package, and every file in it is judged.

An import through an index file loads every file it re-exports to reach one name, and a test runner, unlike a bundler, pays for all of them. A folder's index lists names nothing reads through it, and it drifts the first time someone adds a file and forgets it.
