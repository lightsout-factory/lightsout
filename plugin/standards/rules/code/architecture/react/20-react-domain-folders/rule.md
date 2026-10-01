---
summary: "Grouping helpers that return JSX."
checked: false
severity: advisory
requires:
  - folder-index-file
  - module-out-of-common
  - ungrouped-domain-utils
---

## React Domain Folders

Group functions that return JSX by subject, like any other functions, as `ungrouped-domain-utils` says: `getDesignStepConfig.tsx` and `getInstallStepConfig.tsx` move from `utils/` into `stepConfigs/`.

Returning JSX does not change what a function is about.
