---
summary: "Where constants go."
checked: false
severity: advisory
---

## Constants

Put a constant in the `constants/` folder of the lowest `common/` its users share, as `shared-code-placement` says, never in `types/`. A constant only one module uses stays in that module's own `common/constants/`. A `const` object with its derived union and lookup map lives in `constants/` under the object's name, as `bare-string-union` and `derived-lookup-map` say.

```typescript
// common/constants/defaultConfig.ts
import type { Config } from '@/path/to/common/types/Config';

export const defaultConfig: Config = { name: 'default' };
```

A constant may instead keep its type in the same `constants/` file, named for the value, under `multi-export`'s exception 5. When the type has any other consumer, it goes in `types/`.

Constants are values, not types, so they get a folder of their own.
