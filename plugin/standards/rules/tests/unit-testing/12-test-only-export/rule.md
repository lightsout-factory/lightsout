---
summary: "Code that only its own tests use."
checked: true
severity: advisory
---

## Test Only Export

An export whose only references are test files is a question, not a violation. Production never calls it, so it may be dead code that a test keeps alive, or an export made public on purpose whose contract the tests pin. The finding asks the question; a human answers it.
