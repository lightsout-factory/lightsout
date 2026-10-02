---
summary: "Where shared types go, and which keyword to use."
checked: false
severity: advisory
---

## Types and Interfaces

Place a type like any other code: in the `types/` folder of the lowest `common/` its users share, as `shared-code-placement` says. A type only one module uses stays in that module's own `common/types/`. The folder holds type-level declarations whatever the keyword.

- Use `interface` for object shapes, and `type` for what an interface can't express: unions, intersections, mapped types, primitives, tuples and function signatures.
- For an object shape either works, so stay consistent within a domain. Switching keyword is an edit in place: the file name and imports never change.
- A union family lives in `types/` under the union's name.

```typescript
// copyFile/copyFile.ts: Params stays here, unexported
interface Params {
	sourcePath: string;
	destPath: string;
}

export const copyFile = ({ sourcePath, destPath }: Params) => { /* ... */ };

// copyFile/common/types/CopyResult.ts: copyFile's exported return type
export interface CopyResult {
	success: boolean;
	bytesWritten: number;
}
```

Pick the keyword by fit: the folder does not depend on it.
