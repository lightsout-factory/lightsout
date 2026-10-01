---
summary: "How a test file's describe blocks are named and nested."
checked: true
severity: advisory
---

## Test Nested Describe

Name the first `describe` after the function or class under test, and keep `describe` blocks flat. Vary the scenario through the setup factory's parameters, not through nested `describe` blocks with their own `beforeEach`. When you do nest, title the block `when …` for a condition or `for …` for a variant.
