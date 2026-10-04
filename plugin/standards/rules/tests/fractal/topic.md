# Test Placement

Where unit tests sit, what they cover and how large they grow.

- A module is one export and the code only it uses: a file, or a folder whose main file is named after it.
- A public file is a top-level file of a subject folder, or a module folder's main file. A file in a `common/`, and every other file in a module folder, is private.
- An index file is `index.ts`, or the same name in another dialect such as `index.tsx`. A package's entry is the index file its manifest publishes to other packages.
