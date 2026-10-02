---
summary: "One naming pattern, and one name for each concept."
checked: true
severity: advisory
---

## Synonym Export Name

Use one naming pattern for each kind of name within a domain. Follow the pattern the codebase already uses; never introduce a competing one.

- Data fetching: beside `getUserData`, a new reader is `getUserSettings`, not `fetchUserSettings`.
- Booleans: consistent prefixes, such as `is`, `has`, `should` and `can`.
- Event handlers: one pattern, `onSubmit` or `handleSubmit`.

Never introduce a second verb for a concept that already has a name. Two export names that differ only by a synonym, or only in word order, name one concept:

- `fetch`, `load`, `retrieve` and `read` mean `get`.
- `make`, `generate` and `produce` mean `create`.
- `remove` means `delete`, `modify` means `update`, and `verify` and `check` mean `validate`.

A name on its own may use any verb, such as `readFile`, `loadConfig` or `checkArgs`: this rule is about two living names for one concept. Where a domain has standardized on another verb, such as `fetch`, keep that verb.

When names follow one pattern, a reader can guess a name and a search finds it. A synonym is missed by a search, so the concept gets written again, and `duplicate-function-body` and `duplicate-code-block` cannot catch the copy, because it was written separately and looks nothing like the first.
