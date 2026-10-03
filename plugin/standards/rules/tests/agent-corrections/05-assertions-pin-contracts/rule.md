---
summary: "What a test asserts against."
checks: agent
severity: advisory
---

## Assertions Pin Contracts

- Assert against literals. Never import a constant from the module under test into its own assertions: comparing a value to itself passes even when the value is wrong. The literal is the contract's independent second statement, not duplication. Constants from other modules, such as shared enums, are fine as inputs.
- Pin machine-facing values exactly: error codes, event names, API fields. Pin human-facing text, such as UI copy and log messages, loosely, with `stringContaining` or a regex, or not at all, so a wording change fails no contract test.
- Assert what the unit does: its output, or a side effect at its boundary, such as an injected repository called with the right arguments. Never assert that an input comes back unchanged, unless exposing it is the unit's job: for a class whose job is to resolve and expose state, its public fields are its output. Never reach into what a consumer never touches, such as private helpers or caches.
