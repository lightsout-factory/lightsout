---
summary: "How a file's name follows what it exports."
checks: deterministic
severity: advisory
---

## Filename Mismatch

Name a file exactly as its export, casing included: `buildVersionedLabel.ts`, `UserProfile.ts`. A file with a union and its member types takes the union's name.

A file named like its export is found by searching for the export.
