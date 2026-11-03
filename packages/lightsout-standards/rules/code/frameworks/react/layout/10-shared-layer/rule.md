---
summary: "Where code that several features use lives."
checks: both
severity: advisory
requires:
  - feature-folders
example:
  kind: repo
  focus:
    fail: src/shared/StatusBadge.tsx
    pass: src/components/ui/StatusBadge.tsx
---

## Shared Layer

Put what two or more features use at the top of `src/`, in a folder named for its kind:

- `components/` — shared components, grouped by subject once there are enough to group: `components/ui/` for the design system's primitives, `components/icons/`, `components/markdown/`.
- `layouts/` — the frames routes share, each named with a `Layout` suffix, the parts only they use, and the root document.
- `providers/` — the context providers wrapped around the app, each with the context it provides.
- `hooks/`, `utils/`, `types/`, `constants/` — as in a feature.
- `styles/` and `assets/` — stylesheets, fonts and images.
- The folders the framework's rules add.

Code one feature uses stays in that feature. When a second feature needs it, move it here and update the imports; when a shared file is down to one user, move it back into that feature.

Then `features/` is the product, the top of `src/` is what holds it up, and shared code is found by kind without opening a feature.
