---
summary: "Folder names that say nothing about what the folder holds."
checked: true
severity: advisory
---

## Banned Folder Name

Never name a folder `helpers/`, `lib/`, `core/`, `misc/` or `shared/` anywhere inside a package's `src/`, `common/` included. Name a folder `utils/`, `types/` or `constants/` only inside `common/`.

- `components/`, `hooks/`, `services/`, `controllers/` and `models/` are allowed everywhere, with no framework to declare.
- Name the folder for the domain it serves instead, such as `billing/` or `formatting/`, or move its files into the module that owns them.

A name that says nothing about what a folder holds draws code nobody placed, and `common/` is the only folder name with a meaning of its own.
