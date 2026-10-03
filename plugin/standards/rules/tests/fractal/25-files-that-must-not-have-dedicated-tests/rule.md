---
summary: "Files that need no tests of their own."
checks: agent
severity: advisory
---

## Files That Must NOT Have Dedicated Tests

Never create a test file for a source file with no runtime logic. The tests of the code that uses it cover it:

- constants holding only literal values, with no computation or side effects
- enums with no computed members, and string-union types
- files holding only `type` and `interface` declarations
- index files, which only re-export

A file earns a test only when it holds executable logic. When a constants file does hold logic, such as an environment-variable fallback, test the logic, not the static value.

The one exception is a package's entry. Nothing in the repo uses it, so no other test covers it, and a name dropped from it in a rename or a merge breaks every downstream build while every test still passes. Its test pins only what no other test can reach: the exact set of exported names, and that each arrives as a value rather than `undefined`. It never re-proves what the exported things do; their own tests do that.
