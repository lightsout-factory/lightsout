---
summary: "How a long component or hook is broken up."
checked: false
severity: advisory
---

## React Size Thresholds

A hook composes; it does not compute. Move its pure logic into utility functions the hook calls.

When a component passes its limit in `function-size`, extract sub-components.

Move inline styles and repeated `className` logic into a shared class or component.

Logic outside a component or hook can be read and tested without rendering anything.
