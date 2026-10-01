---
summary: "When component props may use plain string values."
checked: false
severity: advisory
---

## Props Union Exemption

A UI component's discriminated `Props` union may use raw string literals as discriminants, such as `status: 'notInstalled' | 'connected'`, because the caller writes the literal once, as a JSX attribute. `discriminant-const-object` is for domain values that cross module boundaries and are narrowed at many sites. When the same values also appear in domain logic, they are domain values: use the `const` object everywhere, props included.
