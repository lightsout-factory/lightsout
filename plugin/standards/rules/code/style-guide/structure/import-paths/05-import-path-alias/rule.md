---
summary: "When imports use the package's path aliases."
checked: true
severity: advisory
---

## Import Path Alias

Use the package's configured path alias for every import. A package has aliases when it declares `imports` in `package.json` or `compilerOptions.paths` in `tsconfig.json`, and then never uses a relative path (`./`, `../`), not even for a sibling file, a `common/` subfolder or a package entry's re-exports.

When a package declares no aliases, use relative paths consistently, and consider adding aliases.

Read the alias from the package's own declaration; never write one from memory, because packages differ. An `imports` alias resolves literally, so the specifier carries the extension of the file it names: `#src/cli/shipCommand.ts`, never `#src/cli/shipCommand`. A `paths` alias is resolved the usual way, so it takes no extension.

```typescript
// Correct: an imports alias, then a paths alias
import { features } from '#src/features/home/common/constants/features.ts';
import { features } from '@/features/home/common/constants/features';

// Incorrect in a package with aliases
import { features } from './common/constants/features';
```

Then every import of a file reads the same, wherever it is written.
