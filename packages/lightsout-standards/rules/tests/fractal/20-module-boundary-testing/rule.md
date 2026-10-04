---
summary: "Testing a module through what it makes public."
checks: agent
severity: advisory
---

## Module Boundary Testing

Test a module through its public file, and cover the files only it uses through that file.

- A public file is a top-level file of a subject folder, or a module folder's main file. Each gets a test beside it.
- A file in `common/` gets a test of its own: several callers rely on it.
- A file private to one module gets a test of its own only when its cases are too many to drive through the public file, when it is a contract that stands alone, such as a parser, or when coverage a gate demands cannot be reached through the public file.
- A file with no logic, such as a type, a constant of fixed values or an index file, gets no test.
- An existing direct test stays. When a new test could go either way, write it against the public file.

A branch no input reaches, through the public file or directly, is dead code: delete it instead of testing it.

A test through the public file pins behaviour, not how the module is split inside, so the insides can be reorganised without touching a test.
