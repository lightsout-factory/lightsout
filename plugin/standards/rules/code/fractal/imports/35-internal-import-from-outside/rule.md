---
summary: "Keeping a folder's private files private."
checks: deterministic
severity: off
---

## Internal Import From Outside

Put a folder's private files in its `internal/` folder, and import them only from files inside that folder. Everything outside `internal/` is the folder's public API.

```
src/ingestion/
├─ ingestRecords.ts        # public: anyone may import it
└─ internal/
   └─ parseRow.ts          # private to src/ingestion/
```

- Any file inside the folder, tests included, may import from its `internal/`.
- From outside, import the public file that uses it instead, or move the file out of `internal/` when it is genuinely shared.
- Nested folders nest the rule: `src/ingestion/parser/internal/tokenize.ts` is private to `src/ingestion/parser/`.
- An `internal/` folder may sit in any folder, beside what `module-folder-layout` allows.
- `internal/` marks privacy only. Inside it, place code as anywhere else.

Then privacy shows in the import line itself, with no list elsewhere to consult.
