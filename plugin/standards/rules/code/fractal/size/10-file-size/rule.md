---
summary: "How long a file may grow."
checks: deterministic
severity: advisory
options:
  file: 250
  tsxFile: 300
---

## File Size

Keep a file to 250 lines or fewer, or 300 for a `.tsx` file, where JSX and props interfaces earn the room. At the cap, split the file, or turn its module into a folder as `module-file-to-folder` says.

An index file in any dialect, `index.tsx` included, is exempt: a package's entry is its public API, and it cannot take the remedy a size finding asks for.
