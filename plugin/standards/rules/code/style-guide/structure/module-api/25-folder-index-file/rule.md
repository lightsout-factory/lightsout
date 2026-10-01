---
summary: "Which folders may have an index file."
checked: true
severity: advisory
---

## Folder Index File

Only a package's entry is an index file. Delete an index file in any other folder, and import each name from the file that declares it.

Every import already names the declaring file, as `import-through-index` says, so a folder's index lists names nothing reads through it, and it drifts the first time someone adds a file and forgets it.
