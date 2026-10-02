---
summary: "What a component's file holds, and when it becomes a folder."
checked: false
severity: advisory
requires:
  - folder-index-file
  - module-folder-layout
  - single-file-domain-folder
  - ungrouped-domain-utils
---

## Component File Structure

A component is a module: one `.tsx` file until it needs files only it uses, as `module-file-to-folder` says.

Leave a component's return type to inference, an exception to `explicit-return-type`. React's own types are a component's contract, so an annotation such as `JSX.Element` only adds noise.
