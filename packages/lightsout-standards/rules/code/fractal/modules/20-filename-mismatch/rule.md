---
summary: "How a file's name follows what it exports."
checks: deterministic
severity: advisory
---

## Filename Mismatch

A file is named after its export, as `multi-export` says. Choose how that name is cased in this order:

1. Match the other files in the same folder.
2. Otherwise, in a new or empty folder, keep the export's own casing: `buildVersionedLabel.ts`, `UserProfile.ts`.

A file named like its export is found by searching for the export.
