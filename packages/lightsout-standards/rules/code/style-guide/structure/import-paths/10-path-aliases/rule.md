---
summary: "Which path alias to use, and how to write it."
checked: false
severity: advisory
---

## Path Aliases

Each package declares its own path aliases, in `package.json` `imports` or in `tsconfig.json` `compilerOptions.paths`. Read the package's own declaration for the alias; never write one from memory. Common ones:

| Alias | Declared in | Example |
| --- | --- | --- |
| `#src/*` | `package.json` `imports` | `import { X } from '#src/common/utils/X.ts'` |
| `@/*` | `tsconfig.json` `paths` | `import { X } from '@/common/utils/X'` |
| `@src/*` | `tsconfig.json` `paths` | `import { X } from '@src/common/utils/X'` |

An `imports` alias resolves literally, so the specifier carries the extension of the file it names: `#src/cli/shipCommand.ts`. An extensionless `#src/cli/shipCommand` names a file that does not exist. A `paths` alias is resolved the usual way, so `@/cli` is right there.

Packages differ, and a remembered alias may be one this package never declared.
