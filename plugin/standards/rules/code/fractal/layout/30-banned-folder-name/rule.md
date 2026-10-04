---
summary: "Folder names that say nothing about what the folder holds."
checks: both
severity: advisory
---

## Banned Folder Name

Name a folder for its subject, such as `billing/` or `formatting/`, never for the kind of code it holds.

- `utils/`, `services/`, `helpers/`, `lib/`, `core/`, `misc/`, `shared/` and `internal/` are never folder names.
- `types/` and `constants/` are folder names only at the top of a `common/`.

A name that says nothing about what a folder holds draws code nobody placed, and `common/` is the only folder name with a meaning of its own.
