---
summary: "Keeping one naming pattern within an area of the code."
checked: false
severity: advisory
---

## Naming Consistency

Use one naming pattern for each kind of name within a domain. When the codebase already uses one, follow it; never introduce a competing one.

- Data fetching: one of `getData`, `fetchData` or `loadData`, not a mix. Beside `getUserData`, a new reader is `getUserSettings`, not `fetchUserSettings`.
- Booleans: consistent prefixes, such as `is`, `has`, `should` and `can`.
- Event handlers: one pattern, `onSubmit` or `handleSubmit`.

When names follow one pattern, a reader can guess a name and search finds it.
