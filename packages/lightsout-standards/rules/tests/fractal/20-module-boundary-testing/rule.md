---
summary: "Testing a module through what it makes public."
checked: false
severity: advisory
requires:
  - files-that-must-not-have-dedicated-tests
---

## Module Boundary Testing

Test a module through its public API by default, and cover its internals through it. Import what a test exercises from the file that declares it, never through an index file. A test inside a module may import the module's other files; a test outside it imports only the module's public files, as any other caller would.

Give a file a direct test of its own when it earns one:

- Its cases are combinatorial, and driving them all through the boundary is impractical.
- It states a contract that stands on its own, such as a parser or a date formatter, which callers rely on whichever module holds it.
- Coverage a gate demands cannot be reached through any boundary input, and the branch is not dead code.

A direct test does not require making the file public, and an existing direct test is not debt to migrate. When both would pin the same behaviour, write the boundary test.

A branch no input reaches, through the boundary or directly, is dead code: flag it for deletion instead of forcing a test onto it.

A boundary test pins behaviour, not how the module is split inside, so the internals can be reorganised without touching a test. An import through an index file loads every file it re-exports to reach one name.
