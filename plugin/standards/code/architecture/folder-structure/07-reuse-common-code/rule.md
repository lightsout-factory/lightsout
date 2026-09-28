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

Before you write a helper, type, constant or service, look for one in every `common/` folder in the package.

- If one does what you need, import it. Never write a second copy.
- If it sits in another module's `common/`, move it up as shared-code-placement says, then import it.
- If one nearly does, extend it rather than write a near copy, as long as its current callers keep working.

Two copies drift apart, and a fix then reaches only one of them.
