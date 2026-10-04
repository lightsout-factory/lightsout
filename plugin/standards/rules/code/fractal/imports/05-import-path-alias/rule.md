---
summary: "When imports use the package's path aliases."
checks: deterministic
severity: advisory
---

## Import Path Alias

Use the package's configured path alias for every import. A package has aliases when it declares `imports` in `package.json` or `compilerOptions.paths` in `tsconfig.json`, and then never uses a relative path (`./`, `../`), not even for a sibling file, a `common/` subfolder or a package entry's re-exports.

When a package declares no aliases, use relative paths consistently.

Read the alias from the package's own declaration; never write one from memory, because packages differ.

A `paths` alias, declared in `tsconfig.json`. It takes no file extension:

```jsonc
// tsconfig.json
"paths": { "@/*": ["./src/*"] }
```

```typescript
import { features } from '@/features/home/common/constants/features';
```

An `imports` alias, declared in `package.json`. It names the real file, so it carries the extension:

```jsonc
// package.json
"imports": { "#src/*": "./src/*" }
```

```typescript
import { features } from '#src/features/home/common/constants/features.ts';
```

Incorrect in a package with either alias:

```typescript
import { features } from './common/constants/features';
```

Then every import of a file reads the same, wherever it is written.
