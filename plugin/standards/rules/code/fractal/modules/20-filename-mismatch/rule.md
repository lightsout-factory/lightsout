---
summary: "How a file's name follows what it exports."
checked: true
severity: advisory
---

## Filename Mismatch

A file is named after its export, as `multi-export` says. Choose how that name is cased in this order:

1. Match the other files in the same folder.
2. Follow the package's framework, such as NestJS, whose files are `kebab-case.{suffix}.ts`.
3. Otherwise, in a new or empty folder with no framework convention, keep the export's own casing: `buildVersionedLabel.ts`, `UserProfile.ts`.

A framework's naming overrides both the name and its casing:

- A file router owns every name in its route folder, such as `__root.tsx` or `runs.$runId.tsx`, though each of those files exports `Route`. Files under a package's router folder are exempt: `routes/` for TanStack Router and Remix, `app/` and `pages/` for Next, and `app/` for Expo Router.
- An entry file the framework finds by its name keeps that name: TanStack Start's `src/router.tsx`, `src/server.ts` and `src/client.tsx`, and NestJS's `src/main.ts`.
- NestJS names a service's file `events.service.ts`, though its class is PascalCase.

A file named like its export is found by searching for the export.
