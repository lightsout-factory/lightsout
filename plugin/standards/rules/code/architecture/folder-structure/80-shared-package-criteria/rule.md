---
summary: "What belongs in the shared package."
checked: false
severity: advisory
---

## Shared Package Criteria

Put code in the shared package only when two or more packages need it, it has no framework dependencies, and it is a contract both sides agree on, such as constants, error codes or pure predicates. Never when:

- One package needs it. Put it in that package's `common/`.
- It imports a framework. Keep the pure part shared, and wrap it locally.
- It is an implementation detail, such as a hook, guard or resolver.

For example, `packages/shared/src/permissions/hasPermission.ts` holds the pure function, and each package that needs a framework form wraps it locally, such as a React hook or a NestJS guard.

Then every package can import everything in the shared package.
