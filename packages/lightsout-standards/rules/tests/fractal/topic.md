# Test Placement

Where unit tests sit, what they cover and how large they grow.

- A module is one exported item and the code only it uses: a file, or a folder whose main file is named after it. Its public API is the files code outside the module calls.
- An index file is `index.ts`, or the same name in another dialect such as `index.tsx`. A package's entry is the index file its manifest publishes to other packages.
