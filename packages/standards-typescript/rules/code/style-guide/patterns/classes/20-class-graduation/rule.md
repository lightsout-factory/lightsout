---
summary: "a folder created for a class that bundles no private companions"
checked: false
severity: advisory
requires:
  - module-file-to-folder
---

## File vs Folder — The Graduation Rule

Classes follow the same graduation rule as everything else (see [module-file-to-folder](../../../../architecture/architecture-decisions/05-module-file-to-folder/rule.md)):

- **A class starts as a single file** — `RateLimiter.ts` with its test beside it; non-exported helpers may co-locate.
- **A class graduates to a folder** — `HttpClient/` — only when it needs private companions (bundled utils, types, or constants that serve only it). Companions live under `common/` by category (`utils/`, `types/`, `constants/`), and callers import the class from its own file — `HttpClient/HttpClient.ts`.
- Do NOT create a folder for a class with no companions — that is ceremony, not structure.
