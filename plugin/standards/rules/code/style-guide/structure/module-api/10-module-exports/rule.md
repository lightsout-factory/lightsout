---
summary: "How an item is exported."
checked: false
severity: advisory
---

## Module Exports

Always use named exports, on the line the item is defined: functions, classes, interfaces and `as const` named constants alike.

Then every import uses the item's own name, and its definition shows that it is public.
