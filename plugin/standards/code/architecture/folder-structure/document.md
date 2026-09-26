# Folder Structure

Use a `common/` folder pattern for shared code — it keeps related code local, makes dependency scope visible, and scales by promoting code upward only when reuse is proven. The trees below are **folder-modules** (see [module-file-to-folder](../architecture-decisions/05-module-file-to-folder/rule.md)): a feature folder holds a concept and the companions that serve it, and every import names the file that declares what it imports. A folder carries no `index.ts` — only a package's entry does.
