# Imports

How an import names the file it reads from, and what a package makes public.

- An index file is `index.ts`, or the same name in any other dialect: `index.js`, `index.mjs`, `index.jsx`, `index.tsx`.
- A package's entry is the index file its manifest publishes to other packages. It sits at the package root or its `src/`, or the manifest names it, as a subpath export such as `"./contracts": "./src/contracts/index.ts"` does. It is the package's public contract: it lists exactly what other packages may use.
- A route file a file router loads, such as `src/routes/index.tsx`, is a route, not an index file, and importing it imports that route.
