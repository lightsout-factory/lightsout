---
summary: "One concept under two names."
checked: true
severity: advisory
---

## Synonym Export Name

Never introduce a second verb for a concept that already has a name. Two export names that differ only by a synonym, or only in word order, name one concept:

- `fetch`, `load`, `retrieve` and `read` mean `get`.
- `make`, `generate` and `produce` mean `create`.
- `remove` means `delete`, `modify` means `update`, and `verify` and `check` mean `validate`.

A name on its own may use any verb, such as `readFile`, `loadConfig` or `checkArgs`: this rule is about two living names for one concept. Some pairs are deliberate: where a domain has standardized on another verb, `naming-consistency` outranks this rule.

A search by name misses the synonym, so the concept gets written again, and `duplicate-function-body` and `duplicate-code-block` cannot catch the copy, because it was written separately and looks nothing like the first.
