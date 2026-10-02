---
summary: "What belongs on a class and what belongs in functions."
checked: false
severity: advisory
---

## Class Surface

Keep a class's methods to behaviour that needs its state. Put other logic in functions rather than instance methods, placed as `private-helper-colocation` and `module-file-to-folder` say.

Logic that needs no state is easier to read and reuse as a function than as a method.
