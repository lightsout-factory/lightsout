# Shared Code

Shared code lives in `common/` folders. A `common/` folder sits inside the folder whose code shares it: `src/common/` serves all of `src/`, and `src/billing/common/` serves only `src/billing/`.

The folders for each kind of code in `common/`:

| Folder | Holds |
| --- | --- |
| `utils/` | Stateless functions, pure or doing I/O (`formatDate`, `loadConfig`) |
| `types/` | Types (`CopyResult`) |
| `constants/` | Constants (`defaultConfig`, `Action`) |
| `services/` | Classes that hold state (`ApiClient`) |

A domain folder is named for one subject. Inside `common/`, it holds two or more functions about that subject, such as `formatting/` or `parsing/`. Outside `common/`, a domain folder groups related modules under the subject's name and has no main file. The top-level folders of `src/` are domain folders, named for the capabilities the product has, such as `billing/`, `issues/` or `git/`.
