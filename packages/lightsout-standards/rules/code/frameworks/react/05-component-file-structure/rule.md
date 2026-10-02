---
summary: "What a component's file holds, and when it becomes a folder."
checked: false
severity: advisory
requires:
  - index-files
  - module-folder-layout
---

## Component File Structure

A component is a module: one `.tsx` file until it needs files only it uses, as `module-file-to-folder` says.

Leave a component's return type to inference, an exception to `explicit-return-type`. React's own types are a component's contract, so an annotation such as `JSX.Element` only adds noise.

Keep components and hooks short:

- When a component passes its limit in `function-size`, extract sub-components.
- A hook composes; it does not compute. Move its pure logic into utility functions the hook calls.
- Move inline styles and repeated `className` logic into a shared class or component.

Logic outside a component or hook can be read and tested without rendering anything.
