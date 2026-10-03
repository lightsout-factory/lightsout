---
summary: "Which tests a unit needs."
checks: agent
severity: advisory
---

## Test Code Path Coverage

Cover every code path: branches, error handling and boundary conditions. Give each path one test, and never add a test that only varies the input. Inputs that take one path to different outputs share one `test.each`.

To reach a branch that guards against input the types forbid, such as a `default` arm or an early return on an impossible discriminant, force the input with `as unknown as T`. That and the stub cast `test-mock-untyped` allows are the only casts a test writes.
