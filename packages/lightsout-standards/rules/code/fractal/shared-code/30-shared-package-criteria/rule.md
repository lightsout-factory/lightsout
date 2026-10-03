---
summary: "What belongs in the shared package."
checks: agent
severity: advisory
---

## Shared Package Criteria

Never copy code from one package into another. Put it in the shared package instead, but only when two or more packages need it, it has no framework dependencies, and it is a contract both sides agree on, such as constants, error codes or pure predicates. Never when:

- One package needs it. Put it in that package's `common/`.
- It imports a framework. Keep the pure part shared, and wrap it locally.
- It is an implementation detail, such as a hook, guard or resolver.

For example, `packages/shared/src/permissions/hasPermission.ts` holds the pure function, and each package that needs a framework form wraps it locally, such as a React hook or a NestJS guard.

A shared package where everything is public is like a `common/`: its `src/` holds domain folders, not modules. Decide each folder as `module-folder-layout` does: a folder whose every file is something its users call directly is a domain folder.

Copies in each package drift apart, and a fix then reaches only one of them. Then every package can import everything in the shared package.
