# Agent prompts

One markdown file per agent role (feature-executor, unit-test-writer,
refactor-executor, supervisor). Each prompt's output section must match the
role's zod contract in `src/` — the engine rejects and retries anything that
doesn't validate.

`frictionSection.md` and `olderCodeSection.md` are not roles. Each is one
section that every role writing code or tests reads in the same words: a role
prompt marks the place with `{{frictionSection}}` or `{{olderCodeSection}}`,
and the role's `build*Invocation` fills it in. Change the shared file, never a
copy in a role prompt. A standards rule that says "report it" relies on the
friction section, which is what tells an agent where a report goes.

Written fresh for lightsout's typed-contract interface — these are not ports.
