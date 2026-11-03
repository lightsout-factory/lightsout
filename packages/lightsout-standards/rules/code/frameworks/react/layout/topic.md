# React Layout

How a React app's source is laid out: features, the shared layer, screens, layouts and components.

- A **feature** is one area of the product, such as issues or billing, and lives in `src/features/<name>/`.
- A **screen** is the component a route renders. Its name ends in `Screen`.
- A **layout** is the frame a set of routes shares around their screens. Its name ends in `Layout`.
- The **shared layer** is the folders at the top of `src/` that hold what two or more features use.

A folder is named for the kind of code it holds, and a file's name says what it is: a component is PascalCase, a hook starts with `use`. A framework's rules add folder names of their own, and no other folder names exist.
