---
summary: "Look for existing shared code before writing new code."
checked: false
severity: advisory
example:
  kind: repo
  focus:
    fail: src/getInvoiceLabel.ts
    pass: src/getInvoiceLabel.ts
---

## Reuse Common Code

Before you write a helper, type, constant or service, look for one in the `common/` folders, from your own folder up to the package root.

- If one does what you need, import it. Never write a second copy.
- If one nearly does, extend it rather than write a near copy, as long as its current callers keep working.

Two copies drift apart, and a fix then reaches only one of them.
