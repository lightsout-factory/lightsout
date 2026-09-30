# Folder Structure

Shared code lives in `common/` folders. A `common/` folder sits inside the folder whose code shares it, so where it sits shows who uses it: `src/common/` serves all of `src/`, and `src/billing/common/` serves only `src/billing/`.

Inside `common/`, every file goes in a folder for its kind of code:

| Folder | Holds |
| --- | --- |
| `utils/` | Stateless functions, pure or doing I/O (`formatDate`, `loadConfig`) |
| `types/` | Types (`CopyResult`) |
| `constants/` | Constants (`defaultConfig`, `Action`) |
| `services/` | Classes that hold state (`ApiClient`) |

Two or more functions about one subject can also share a folder named for that subject, such as `formatting/` or `parsing/`: a domain folder.

A package's own architecture document may set its concrete folder layout on top of these rules.
