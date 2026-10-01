---
summary: "When a class gets a folder of its own."
checked: false
severity: advisory
requires:
  - module-file-to-folder
---

## Class Graduation

A class is a module: `module-file-to-folder` decides whether it is a file or a folder. Never make a folder for a class that has no files of its own, such as a folder holding only the class and an index file.
