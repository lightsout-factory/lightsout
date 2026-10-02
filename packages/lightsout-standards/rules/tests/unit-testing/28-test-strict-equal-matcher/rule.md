---
summary: "Comparing a whole object, or part of one."
checked: true
severity: blocking
---

## Test Strict Equal Matcher

Compare a whole object with `toStrictEqual` and a concrete expected object. For a partial match, use `toEqual` with an asymmetric matcher, such as `toEqual(expect.objectContaining({ ... }))`. Never pass an asymmetric matcher (`expect.objectContaining`, `arrayContaining`, `any`, `stringContaining` or `stringMatching`) to `toStrictEqual`: Jest then runs only the matcher, so the strict checks never fire, and the name claims a strictness the test does not have.
