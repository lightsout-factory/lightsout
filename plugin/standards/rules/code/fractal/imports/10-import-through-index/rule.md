---
summary: "Where an import should point."
checked: true
severity: advisory
---

## Import Through Index

Every import names the file that declares what it imports: `@/ingestion/ingestRecords`, never `@/ingestion`. Never import through an index file.

- Import from another workspace package through its entry, such as `@acme/engine`, never a path into its `src/`.
- Code inside a package never imports its own entry.
- An index file may re-export from another index file, and an index file's own test imports the file it tests.
- This rule judges only files that belong to a package. Where the repo's manifests declare workspace packages, a file outside all of them, such as a build script at the repo root, is not held to it. A repo that declares none is one package, and every file in it is judged.

An import through an index file loads every file it re-exports to reach one name, and a test runner, unlike a bundler, pays for all of them.
