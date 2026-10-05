# Layout

Every folder under `src/` is one of three kinds.

**A module** is one export and the code only it uses. It is one file, named after its export. It becomes a folder, with a main file of the same name, only when it needs files of its own, and goes back to a file when the folder is down to one. The folder takes its export's name and casing, so a class folder is PascalCase: `HttpClient/HttpClient.ts`. Everything in the folder except the main file is private to the module.

**A subject folder** groups modules about one subject, such as `billing/` or `git/`, and has no main file. Everything at its top level is public. The top folders of `src/` are subject folders.

**`common/`** holds what a folder's contents share. It sits in the lowest folder that contains every file using it, and is private to that folder. Functions and classes sit directly in it, types in `common/types/`, constants in `common/constants/`. A file with both a type and a value goes by its value.

Never make any other kind of folder.
