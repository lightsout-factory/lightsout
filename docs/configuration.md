# Configuration

Lightsout is configured from a single file at the root of your repository:

```text
lightsout.config.json
```

A run reads this file once, when it starts, from the checkout the command was launched in. Every later step of the run uses that configuration, including the standards checks and the agents' self-check, and so does every resume of the run. An edit therefore takes effect on the next run started from a checkout that holds it. The run records the file's path, which `lightsout status --run` shows. A gate command that itself runs a `lightsout` command is its own command, and reads the `lightsout.config.json` of the checkout it runs in.

## Minimal setup

To run lightsout, define the commands it should use to verify the work:

```json
{
  "gates": {
    "check": "pnpm check",
    "test": "pnpm test:unit",
    "test-coverage": "pnpm test:unit:coverage"
  }
}
```

## Common configurations

### Use lightsout’s code standards

Standards are opt-in. The minimal configuration above runs with none: agents get no rules, and no standards checks run. `lightsout doctor` says so. Turn on lightsout’s bundled JavaScript and TypeScript standards by naming their pack with `standards-pack`:

```json
{
  "standards-pack": "lightsout/standards",
  "gates": {
    "check": "pnpm check",
    "test": "pnpm test:unit",
    "test-coverage": "pnpm test:unit:coverage"
  }
}
```

`lightsout/standards` holds every bundled rule. Its framework rules are conditional: the React, TanStack Start and NestJS rules reach only a package whose own `package.json` declares that framework, so one pack fits the root and every package of a monorepo. The run header names the pack, and each framework pack that applied.

### Use your own standards

Register your standards library with `standards-libraries` (see
[Register standards libraries](#register-standards-libraries)), then select one
of its packs with `standards-pack`, written `<library>/<pack>`:

```json
{
  "standards-libraries": { "acme": "./standards/acme" },
  "standards-pack": "acme/standards",
  "gates": {
    "check": "pnpm check",
    "test": "pnpm test:unit",
    "test-coverage": "pnpm test:unit:coverage"
  }
}
```

### Configure a monorepo

Use `package-gates` to run gates only for packages affected by the current change. The `{package}` placeholder is replaced with each package name.

```json
{
  "packages-dir": "packages",
  "package-gates": {
    "check": "pnpm --filter {package} check",
    "test": "pnpm --filter {package} test:unit",
    "test-coverage": "pnpm --filter {package} test:unit:coverage",
    "build": "pnpm --filter {package} build"
  },
  "gates": {
    "check": "pnpm check",
    "test": "pnpm test:unit",
    "test-coverage": "pnpm test:unit:coverage"
  }
}
```

Use `package-standards-packs` to give a package standards of its own. Each key is the package’s folder name under `packages-dir`, as `--packages` uses it, and each value is a pack address or a list of them:

```json
{
  "standards-pack": "lightsout/standards",
  "package-standards-packs": {
    "web-app": "lightsout/react"
  }
}
```

A package the map does not name uses `standards-pack`, and has no standards when that is unset.

See [Monorepos](monorepos.md) for package detection, gate resolution and how standards follow each package.

## How verification works

Lightsout does not ask an agent whether its work is correct. It runs your commands directly and uses their exit codes to decide whether the pipeline can continue.

At every verification stage, `generate` runs first when you configured one — it
writes the files the gates then read. Between the phases of a phased plan, build
output is carried on disk, uncommitted, from the last gate that rebuilt it, and
discarded once the whole sequence passes. Set `gates.generate` to rebuild every
generated path your checks read: a command that rebuilds only some of them draws
no `lightsout doctor` warning. After it, the gates themselves run in two tiers.
The cheap ones come first:

1. `check`
2. `test`, or `test-coverage` in its place when the stage runs coverage

Only once every package group's cheap gates are green does the expensive tier
start:

1. each custom `test-*` suite, in the order you wrote them
2. `build`, when configured

If any command fails, the stage fails and the pipeline stops. A red cheap gate
also means the expensive tier never starts, so an end-to-end suite is never paid
for at a stage that is already red. Every cheap gate still runs, so all of their
failures arrive in one report. The agent cannot override, reinterpret, or talk
its way past a failing gate.

You can replace this order at a given stage with `gate-overrides`, described
below.

The `format` command is different: it runs once at the end of the pipeline, after the implementation and verification stages are complete.

This separation keeps responsibilities clear:

- Agents write and refactor the code.
- Your standards define how the code should be written.
- Your gate commands decide whether the work passes.

These commands become the deterministic gates between pipeline stages. Lightsout runs them directly rather than asking an agent to verify its own work.

This is the smallest complete configuration. Everything else is optional.

### Per-test results

A green command tells lightsout that a suite passed. It does not tell it which
cases ran — and when a plan names the tests that state its acceptance criteria,
that is the question lightsout has to answer.

So on every gate command it sets two environment variables:

- `LIGHTSOUT_JEST_REPORTER` — the absolute path of a small Jest reporter that
  lightsout wrote into the run folder.
- `LIGHTSOUT_TEST_RESULTS_DIR` — the directory that command's per-test results
  go in. Each gate execution gets its own, cleared before the command starts.

To switch this on, load that reporter from your Jest config:

```js
const lightsoutReporter = process.env.LIGHTSOUT_JEST_REPORTER;

module.exports = {
  reporters: lightsoutReporter ? ['default', lightsoutReporter] : ['default'],
};
```

Naming the `reporters` key replaces Jest's default, so `'default'` has to be
restated. Keep the entry conditional: with the variables unset the reporter does
nothing, so an ordinary `pnpm test` on your machine is unchanged.

Only Jest is supported. A gate that runs something else can carry no per-test
result, and lightsout says so at the start of a run rather than at the end of
one.

The results themselves live under the run folder, beside the command log, at
`test-results/<step>/<group>/<gate>/`. The recommended gitignore already ignores
the whole `.lightsout` state directory, so nothing changes there.

`lightsout doctor` reports a `jest-reporter` check for every Jest config it can
load, so a missing entry is visible before a run is ever started.

## Adding your standards

Standards arrive as **standards packs**. A pack is one file in a standards
library that selects topics and rules — topics from the library's `rules/code/`
tree for the agents that write code, and from its `rules/tests/` tree for the
agent that writes tests. Every rule is a folder inside a topic: its prose, the
check that enforces it when one is possible, and the example files that prove
the check works.

A repository selects its packs with `standards-pack`, and each pack brings in
every rule it needs. In a monorepo a package may select different ones with
`package-standards-packs` (see [Configure a monorepo](#configure-a-monorepo)):

```json
{
  "standards-pack": "lightsout/standards",
  "gates": {
    "check": "pnpm check",
    "test": "pnpm test:unit",
    "test-coverage": "pnpm test:unit:coverage"
  }
}
```

The built-in `lightsout` library groups its rules into packs by what each is
for, so a repository can take one goal without the others:

| Pack | What it is for |
| --- | --- |
| `lightsout/fractal` | Keeps the repo the same shape at every level, so any file's place is predictable and a duplicate is found by searching for its name. |
| `lightsout/code-style` | Makes code read the same whoever wrote it: one way to write a function, a class, a set of named values, a type-safe value and a unit test. |
| `lightsout/standards` | Both of the above: the standard for a package with no framework pack of its own. |
| `lightsout/react` | The rules written for React: function size measured for hooks and components, and one way to write a component test. |
| `lightsout/tanstack-start` | The rules written for TanStack Start: which of its files get unit tests. |

`standards-pack` takes one pack address or a list of them. Listed packs apply
in order, and the last listed wins where two grade one rule differently:

```json
{
  "standards-libraries": { "acme": "./standards/acme" },
  "standards-pack": ["lightsout/standards", "acme/standards"]
}
```

The selection applies to the repository root and every package
`package-standards-packs` does not name. A pack that no registered library holds
fails the run. Every rule is named `<library>/<rule>`, where the library is the
`name` in its `lightsout-standards.json`, so two libraries may each hold a rule
with the same short id.

Standards are opt-in. With no `standards-pack` set, the root and every package
`package-standards-packs` does not name run with no standards, and
`lightsout doctor` notes it. Setting `standards-pack` to `false` means the same
and records the choice, so the doctor stays quiet.

### Register standards libraries

A **standards library** is a folder holding `lightsout-standards.json`, the
topics and rules it defines under `rules/code/` and `rules/tests/`, and a
`packs/` folder beside them of pack files that select and tune those rules. `standards-libraries` registers libraries beside the one
lightsout ships. Each key is the library's name, and each value says where the
library lives:

```json
{
  "standards-libraries": {
    "acme": "./standards/acme",
    "acme-platform": "@acme/platform-standards"
  }
}
```

- A value starting with `./` or `../`, or an absolute path, is a folder, read
  against the root of your repository.
- Any other value is an npm package name, looked up in `node_modules` from the
  root of your repository upward, the way Node finds a package. A package
  linked from your own workspace loads from its source folder.

The `name` in the library's `lightsout-standards.json` must equal its key, and
a library that does not match, or will not load, is a hard error. `lightsout`
is the built-in library's name and is reserved.

Each pack is one `.json` file in a library's `packs/` folder, addressed
`<library>/<file-stem>` — `lightsout/standards` is `packs/standards.json` in the
built-in library. Only `.json` files there are packs; anything else in the
folder is ignored.

A pack file holds a `description`, an `include` block listing the `packs`,
`topics` and `rules` it brings in, and optional `rule-settings` for the rules it
holds. A pack may also be conditional, by declaring `applies-when`:

```json
{
  "description": "Keeps React components, hooks and their tests to one shape, in each package that uses React.",
  "include": { "topics": ["lightsout/code/frameworks/react", "lightsout/tests/frameworks/react"] },
  "applies-when": { "dependencies": ["react", "preact", "react-dom"] }
}
```

A conditional pack brings its rules to a package only when that package's own
`package.json` declares one of the listed dependencies, in `dependencies`,
`devDependencies` or `peerDependencies`. The repository root is judged by the
root `package.json`. This is how a single pack serves a monorepo: it includes a
conditional pack for each framework, and each package gets the ones it uses. A
`rule-settings` or `standards-rule-settings` entry naming a rule that only a
pack which did not apply would bring is accepted and does nothing.

A rule that lightsout checks with code ships exactly one check file: `check.ts`
or `check.js`. A library published to npm ships `check.js`, because Node will
not strip types from a file under `node_modules`, and a `check.ts` found there
fails the load. A library linked from your own workspace loads from its source
folder, so it may ship `check.ts`.

### Commands for working with a pack

`lightsout standards-validate [--library <path>]` validates a standards
library. It runs every check against its own pass and fail fixtures, and it
checks every pack file: each include entry names a pack, topic or rule that
exists, each `rule-settings` entry names a rule already in the pack, and no
packs include each other in a cycle. Without the flag it validates the library
lightsout ships. A pack's includes resolve against the built-in library and the
repository's `standards-libraries`, with the validated library in place of the
one that shares its name. This is the gate to run while writing a rule: a check
that lets its fail fixture through catches nothing, and one that flags its pass
fixture cries wolf. Neither is visible when the library loads, and both are
exactly what an author needs told. It validates every rule regardless of
channel, because authoring covers every channel. It also judges each pack file
on its own and warns once for each rule the pack sends to agents without a
rule that rule requires. Warnings never fail it: a team may mean to take one
topic pack alone.

A rule's `rule.md` header may list the rules its text depends on under
`requires:`. A short id names a rule in the same library, and a full name
(`<library>/<rule>`) names a rule in any library. A name that matches no rule
fails loading. A required rule is missing when it will not reach agents: the
pack does not hold it, or the pack holds it at `off` and the repository has
not turned it on. `standards-validate` warns the library's author about each
missing requirement, and `lightsout doctor` warns the repository, per package
group. Runs never warn.

`lightsout standards-health` reports on the rules rather than on your code: per
rule, whether it has a deterministic check or an agent check, and how often agents
declined its findings, with the reasons they gave. The coverage half is counted
from the package's own folders, so it lands even in a repository that has never
run anything. The decline half is aggregated from the refactor runs recorded
under `.lightsout`, and reads `—` until you have some.

`lightsout standards-check` reports what your code breaks today. It runs both
halves of the check by default — the deterministic checks your rules ship as
code, and an agent review reading the rules with an agent check. Pass
`--deterministic-checks` for only the first, or `--agent-review` for only the
second. The agent's findings are always advisory: they join the same reported
stream, and they never fail a run. A run that includes the deterministic checks
writes `.lightsout/standards-check.json`; a review-only run prints and writes
nothing, because that file is the deterministic half's evidence and an agent's
reading must not overwrite it. A repository whose harness is not installed gets
a plain "agent review skipped" note rather than a failure.

## Field reference

The table below lists the top-level keys. A block with keys of its own — `gates`,
`standards-rule-settings`, `ship`, `ticket-tracker`, `queue`, `plan`, `implement`,
`auto-plan` and `docs` — is documented in the
subsections beneath it.

The table is generated from the engine’s own descriptions, the same sentences the
Config page shows, so the two cannot drift apart. An edit inside the comment markers
is overwritten the next time `pnpm build:config-reference` runs.

<!-- generated:config-key-reference -->

| Field | Required | What it controls |
| --- | ---: | --- |
| `harness` | no | Harness name. Supported values are 'claude-code', 'codex', 'omp' (Oh My Pi) and 'pi' (bare upstream pi). Defaults to 'claude-code'. |
| `model` | no | Model override passed through to the selected harness. |
| `effort` | no | Reasoning effort passed through to the harness — one of `low`, `medium`, `high`, `xhigh` or `max`. Omit to take each harness's own default. |
| `permissions` | no | Harness-neutral capability level for agent invocations: `write` lets agents edit files and run commands inside the workspace, `full-access` bypasses the harness's sandbox entirely. Defaults to 'write'. `read-only` is engine-selected for the supervisor and is deliberately not settable — it would make a writing role write nothing. |
| `commands` | no | Per-command harness selection for `plan`, `implement`, `refactor`, `test-coverage-to-threshold` and `improve` (`plan` covers draft, dedup and grade; `resume` always keeps the run manifest’s recorded harness, and takes model and effort from the configuration the run recorded when it started, never from the file as it reads now). Each entry overrides the global harness, model and effort for that command; unlisted commands use the globals. A global model is not inherited by a command that selects a different harness; a global effort is, because the five levels mean the same thing everywhere. An unknown command key is rejected rather than silently ignored. |
| `gates` | yes | Verification commands — the mechanical gates. Full shell commands, run by the engine itself; agents never run them. |
| `timeouts` | no | Agent invocation ceilings, in minutes. A hit ceiling is a recorded step failure the run can resume from — never a crash. |
| `timeouts.agent-minutes` | no | Ceiling for the working roles — executor, test writers, refactorer, fixes. Defaults to 60. Reaching it stops the harness together with every process it started — a terminate signal first, then a kill if that is ignored. |
| `timeouts.supervisor-minutes` | no | Ceiling for the read-only supervisor, which reads and rules rather than editing. Defaults to 15. |
| `timeouts.gate-minutes` | no | Ceiling for one gate command — the repo's own check, test, coverage, build or end-to-end run. A gate that runs past it is stopped and re-run once; a gate that runs past it again stops the run as a timeout, which names the gate and the ceiling and is reported apart from a gate that failed. Such a gate is never handed to a fix agent and spends no fix attempt. Defaults to 15. |
| `agent-commands` | no | Command prefixes working agents are granted (prefix match, arguments allowed) — for plan deliverables only a command can produce, such as a migration generator. Verification commands never belong here: the engine runs all gates itself. The one verification command an agent is handed is the engine’s own self-check, granted per spawn to the roles that write code rather than configured here. |
| `generated` | no | Path prefixes of generated or derived files. Real files in the diff, but excluded from changed-file attribution — the source that generates them is the change. Also where a repo says its build output lands when the walk cannot guess it. In a phased plan each phase’s commit leaves those changes on disk so the next phase starts from current build output, and the sequence discards them once it passes; a repo whose checks read those paths should set `gates.generate` so every set of gates starts from current output. A worker’s commit never carries them — the pre-ship step at merge time is the one place they are committed. |
| `vendored` | no | Path prefixes of third-party code the repo vendors in rather than writes, such as a shadcn/ui component folder. Excluded from the source walk exactly as `generated` is, so the standards never judge it, no test is written for it and no refactor pass touches it — with one difference: a vendored file IS attributed when it changes, because no source in the repo produced it. Excluding it from a coverage threshold is your test runner’s job, not the engine’s. |
| `coverage-summary-path` | no | Path to the JSON coverage summary the coverage tooling writes — the `json-summary` reporter’s `coverage-summary.json`, which `lightsout test-coverage-to-threshold` reads for per-file percentages. Defaults to `coverage/coverage-summary.json`, repo-relative in single-package repos and package-relative in monorepo mode. The file is the tool-agnostic contract, so a printed coverage table changing format never breaks a run. |
| `executor-file-limit` | no | How many source files one plan or phase may create or modify before the feature executor refuses it as out of scope. Defaults to 50. One key rather than a number per reader, so the plan lint, the scope estimate and the executor’s own stop rule agree by construction. A plan that is mostly mechanical edits raises its own allowance with a `## File Budget` section rather than moving this key, but a `## File Budget` cannot lift a plan or phase past the fixed touched-file ceiling of 70 source files unless that plan or phase is rename-only; the separate ceiling on files a plan creates is fixed and cannot be raised either way. A move-folders-and-files plan or phase is exempt from that touched-file ceiling as well, and from this limit and its own `## File Budget`: its size is bounded by the build-time move check instead. |
| `packages-dir` | no | Directory holding workspace packages, for monorepo scoped gates. Defaults to `packages`. |
| `package-gates` | no | Monorepo scoped gate templates — the per-package commands `{package}` is substituted into. Each template runs once per affected package, so a gate runs only for the packages a change touched. |
| `gate-overrides` | no | Opt-in per-checkpoint gate schedules, keyed by the four verification checkpoints — `clean-slate`, `verify-implement`, `verify-tests` and `verify-refactor`. A checkpoint listed with an array runs exactly those gates, in that order, with no tiering, and a red one stops the rest of the list; `"off"` runs no gates at all there, `gates.generate` included. A checkpoint the block does not list keeps the engine’s default: the cheap gates first — check, then the unit suite — and the expensive ones, each custom `test-*` suite and the build, only once every package group’s cheap gates are green. A name must be a gate this repo configures under `gates` or `package-gates`; `generate` and `format` may not be named. |
| `standards-pack` | no | The standards for the repo root and every package `package-standards-packs` does not name: one pack address, written `<library>/<pack>`, or a list of them applied in order, the last listed winning where two grade one rule differently. Standards are opt-in: unset and `false` both mean no standards for the root and every package the map does not name. A pack that declares `applies-when` reaches only the packages whose own `package.json` declares one of the dependencies it names. |
| `package-standards-packs` | no | Standards of its own for each package that differs from `standards-pack`. Each key is a package folder name under `packages-dir`, as `--packages` uses it, and each value is a pack address, `<library>/<pack>`, or a list of them. A package the map does not name uses `standards-pack`, and has no standards when that is unset. `false` is accepted only by `standards-pack`, never here. A key naming no workspace package is an error. |
| `standards-libraries` | no | Standards libraries the repo registers beside the built-in one, each a folder of topics, rules and pack files. Each key is a library name and each value is either a folder — a value starting with `./` or `../`, or an absolute path, read against the repo root — or an npm package name, looked up in the repo’s `node_modules`. A library’s manifest `name` must equal its key, and `lightsout` is built in and reserved. Versions are fixed the way the rest of the repo’s are: by git for a folder, by the lockfile for a package, and by the plugin version for the built-in library. |
| `standards-rule-settings` | no | Per-rule severity and options settings, applied over the selected pack as the last layer and keyed by full rule name (`<library>/<rule>`), or by short rule id where only one rule in the pack has it. `off` stops a rule running but keeps its prose for agents; `blocking` or `advisory` turns on a rule the pack ships off. An entry naming no rule in the pack is an error. A rule not named here keeps its pack’s setting — silence is never a change. |
| `ship` | no | Opt-in `lightsout ship` settings: the branch ticket pattern whose `ticket` capture group becomes the result’s ticket reference, the pull request body template, the merge method, whether a passed implement run chains into ship, an optional pre-ship command that prepares the release candidate before it is verified, and the explicit exception for a repository that intentionally has no CI. |
| `ticket-tracker` | no | Opt-in tracker identity: which provider the engine talks to and that provider’s address and credential environment variables — a Linear team and API key, or a Jira Cloud site, project, API token and account email. Every command that reads or writes a ticket resolves it from here, so tracker identity is spelled once rather than once per command. |
| `worktree` | no | Opt-in shared workspace preparation. `worktree.setup` is the one command run inside a fresh worktree before any agent, such as `pnpm install` — the queue runs it in each ticket worktree it cuts, and an isolated implementation run runs it in the worktree it cuts for itself. An absent block means nothing runs. The block is strict, so a misspelled key fails parsing rather than silently leaving the command unset. |
| `queue` | no | Opt-in queue settings: which ticket label names each planning status, what this tracker calls each status the engine writes, which statuses count as available work, how many tickets run at once, and the per-ticket worker and question timeouts. Tracker identity lives in `ticket-tracker`, so this block holds queue behaviour only. |
| `auto-plan` | no | Opt-in auto-plan settings: whether the proposal comes before drafting, whether an approved proposal starts the build, and whether the proposal is skipped when nothing clears the escalation bar. Every key is off by default, so an absent block is the most supervised behaviour. |
| `plan` | no | Opt-in plan settings: whether plans are written as contracts with an acceptance-test ledger — a table naming the test that states each acceptance criterion — and graded by weight, spawning the reader fan-out only for the plan files that earn it, plus the counts above which a plan file is heavy. Those are off by default, so an absent block writes and grades plans exactly as before: the same template, the same required sections, every plan file read by every lens. `plan.worktree` is whether a planning session works in its own isolated git worktree rather than the checkout it was launched from — it defaults to true, `--worktree` and `--no-worktree` override it for one command, and the implementation run continues in the tree planning established. `plan.default-work-order-mode` is the mode a work order's own record is created with — `single-plan`, where plan 001 alone supplies the work order's implementation, or `multiple-plan`, where the work order's plans implement in numeric order on one branch and it ships only on an explicit ship request. It defaults to `single-plan` and is read only when a record is created, so it never changes a work order that already has one. The queue creates the record of a ticket it builds from the ticket body — a `planning-not-needed` ticket, or a `planning-complete` ticket with no record yet — in `single-plan` mode whatever the key says. |
| `implement` | no | Opt-in implementation settings. `implement.worktree` is whether an implementation run builds in its own isolated git worktree rather than the checkout it was launched from — it defaults to true, and `--worktree` and `--no-worktree` override it for one run. `implement.refactor.max-rounds` is how many cleanup executor rounds one run may spend at most — a whole number above zero, defaulting to 2, which is also what an absent block spends. The budget is a ceiling rather than a target: cleanup stops early when nothing qualifying is left, and only a deterministic blocking finding the run’s own edits introduced or measurably worsened can spend a round. Whatever cleanup leaves behind is recorded and never stops the run. |
| `pricing` | no | Optional published rates, keyed by the model identifier a harness was invoked with, each entry giving `input`, `output`, `cache-read` and `cache-write` as US dollars per million tokens — the unit vendors publish, so a rate is copied rather than converted. It is optional and has no default. It is read only by `lightsout report`, where it buys one separate, clearly labelled estimated-cost column; nothing computed from it is ever stored, so the activity record stays a statement of what a harness itself reported. Each entry is strict, so a misspelled rate name fails parsing rather than silently leaving that token count unpriced while the column still prints a total. |
| `docs` | no | Opt-in documentation surfaces: each entry a repo-relative path and a one-line `covers` saying what that document is responsible for. Declaring the block turns on the plan-time documentation check — the plan writer is briefed on the surfaces, every implementable plan file must carry a `## Documentation` statement, and `plan grade` runs one whole-plan checker that verifies it. A repository that declares no block sees none of it: no section, no prompt text, no checker spawn. |

<!-- /generated:config-key-reference -->

### Gate keys

| Field                         | Required | What it controls                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------- | -------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `gates.check`                 |      yes | The type-check and lint gate. Provide the full shell command lightsout should run at every verification stage.                                                                                                                                                                                                                                                                                   |
| `gates.test`                  |      yes | The fast test gate — the unit suite. `test` and `test-coverage` are two spellings of the same suite (plain and instrumented), so lightsout runs one or the other, never both.                                                                                                                                                                                                                    |
| `gates.test-coverage`         |      yes | The coverage gate. Provide a shell command, or set it to `false` to opt out. Skipping the strongest gate must be an explicit decision, not an accident. The command must run the same suite `test` runs, instrumented — lightsout substitutes it for `test`.                                                                                                                                     |
| `gates.test-*`                |       no | Any other `test-` key is a custom suite of its own — `test-e2e`, `test-integration`, `test-browser`, whatever your repo calls it. Custom suites are never substituted by coverage and run in the order written here, after the unit suite and before `build`.                                                                                                                                    |
| `gates.generate`              |       no | An opt-in code-generation command, such as `prisma generate`. Runs once before each set of gates. Set it when your checks read `generated` paths: between the phases of a phased plan, build output is carried on disk only as current as the last gate that rebuilt it. The command should rebuild every generated path your checks read — `lightsout doctor` warns only when it is unset, and cannot tell a command that rebuilds only some of them. |
| `gates.build`                 |       no | An opt-in build gate. Runs last during every verification stage.                                                                                                                                                                                                                                                                                                                                 |
| `gates.format`                |       no | An opt-in formatting command. Runs once at the end of the pipeline.                                                                                                                                                                                                                                                                                                                              |

`gates` is the one key every configuration must write. Provide full shell commands:
lightsout runs them itself and decides on their exit codes, so an agent is never asked
whether its own work passed.

### Gate overrides

`gate-overrides` says which gates run at one verification checkpoint. Its keys
are the four checkpoints — `clean-slate`, `verify-implement`, `verify-tests` and
`verify-refactor` — and a checkpoint you do not list keeps the two tiers
described above.

A checkpoint's value is either a list of gate names or the string `"off"`:

```json
{
  "gate-overrides": {
    "verify-implement": ["check", "test"]
  }
}
```

```json
{
  "gate-overrides": {
    "verify-implement": "off"
  }
}
```

A list replaces the tiering entirely: exactly those gates run, in exactly that
order, and a red gate stops the rest of the list. `"off"` runs no gates at all
at that checkpoint, `generate` included.

`generate` runs before a list, exactly as it does under the default order, so it
may not be named in one — nor may `format`, which runs once at the very end of
the pipeline and would not be scheduled by naming it here. Every other name must
be a gate this repository configures under `gates` or `package-gates`; a name
neither block configures fails when the configuration is read. A gate a package
has no script for is skipped for that package and recorded, exactly as it is
under the default order.

### Standards check rules

Every rule the standards check enforces ships with a default severity and, where it has numbers to measure against, its own options, and the selected pack may change both. `standards-rule-settings` is the final layer over the selected pack, one rule at a time:

```jsonc
{
  "standards-rule-settings": {
    // A severity on its own.
    "filename-mismatch": "off",
    "duplicate-code-block": "blocking",
    // Or an object, to change the severity, the rule's options, or both.
    "file-size": { "options": { "file": 300, "tsxFile": 400 } },
    "folder-size": { "severity": "blocking", "options": { "cap": 15 } },
  },
}
```

The three severities are:

- `blocking` — a violation. It stops a run when it touches a file that run changed.
- `advisory` — reported, and handed to the refactor agent as a judgment call. Never blocks.
- `off` — not run at all. This is what you set when your own linter already enforces the rule.

A pack may also ship a rule `off`: a convention some repositories want and most do not, which a repository turns on by naming it here at `blocking` or `advisory`. Until it does, the rule neither runs nor reaches an agent's instructions. A rule you turn `off` yourself stops running but still reaches them, because the standard still holds and your linter is what enforces it.

`lightsout doctor` judges rule requirements after these settings apply, so turning on a publisher-off required rule here clears its warning.

Each key is a full rule name, `<library>/<rule>` such as `lightsout/file-size`, or a short id such as `file-size` that only one rule in the pack has. A key that matches no rule in the selected pack, or a short id that rules in several libraries share, stops the load and names the full candidates, rather than silently disabling a setting you believe is active. Two keys that name the same rule, such as `file-size` and `lightsout/file-size`, stop the load too. Findings, baseline site keys and `standards-check --list` always use full rule names.

Severity is the only lever a run gates on. There is no separate list of blockable rules, so the only way to stop a rule blocking is to write `advisory` or `off` for it here — an explicit line in a committed file.

Run `lightsout standards-check --list` to print every rule with the standards document it enforces and the state it runs at in your repo — the live answer, rather than a list here that goes stale.

#### What the default pack blocks

The pack lightsout ships blocks only what is wrong on its own terms — code that lies about its types (`no-any`, `type-assertion`, `explicit-return-type`), code nothing uses (`dead-export`, `duplicate-function-body`), a tree that breaks across filesystems (`case-collision`), and tests that are silently weaker than they read (`no-test-state-in-hooks`, `test-mock-prefix`, `test-mock-untyped`). Every rule about where files go, what they are called, and how many exports they hold ships `advisory`: it is still reported and still handed to the refactor agent, but a repository adopting lightsout is not blocked on day one by a layout it has not yet agreed to.

A repository that wants the strict profile promotes those rules itself — an explicit, committed list of what it holds itself to. This is the block lightsout's own repository runs:

```jsonc
{
  "standards-rule-settings": {
    "prefer-functions": "blocking",
    "banned-folder-name": "blocking",
    "named-string-values": "blocking",
    "index-file-contents": "blocking",
    "class-inheritance": "blocking",
    "common-folder-layout": "blocking",
    "file-size": "blocking",
    "index-files": "blocking",
    "folder-size": "blocking",
    "function-size": "blocking",
    "react-function-size": "blocking",
    "import-path-alias": "blocking",
    "multi-export": "blocking",
    "single-use-scalar": "blocking",
    "test-beside-subject": "blocking",
    "test-file-size": "blocking",
    "test-manual-mock-cleanup": "blocking",
    "test-support-in-src": "blocking"
  },
}
```

### Ship settings

| Field                 | Required | What it controls                                                                                                                                                                                                                     |
| --------------------- | -------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ship.ticket-pattern` |       no | A JavaScript regular expression source matched against the branch name. It must carry a named group `ticket`, whose value becomes the result's ticket reference; every other named group becomes a token the body template may use. Defaults to `^(?<ticket>[a-z]+-\d+)`. It supplies the pull-request body's tokens and nothing else: which ticket a piece of work belongs to is the `ticketRef` its work order's record saves, so no name is matched to recover one. |
| `ship.pr-body`        |       no | The pull request body template. Brace-wrapped tokens are substituted: `branch`, and one per named group of the ticket pattern. An unknown token is left exactly as written. Defaults to the bare ticket token on its own.            |
| `ship.merge-method`   |       no | How the forge merges: `merge`, `squash`, or `rebase`. Defaults to `merge`.                                                                                                                                                          |
| `ship.after-implement` |       no | When true, a passed `/implement` run chains into ship without `--ship` being typed. Defaults to `false`. It applies to a branch no work order claims and to a `single-plan` work order; a `multiple-plan` ticket ignores it and chains exactly when the run satisfies that ticket's own ship request. |
| `ship.pre-ship`       |       no | A shell command that prepares the release candidate — the home for a repository's own pre-ship convention, such as rebuilding committed build outputs or bumping a shipped version. Ship requires a clean committed branch before it runs, runs it against the freshly fetched default branch (its exact commit is in `LIGHTSOUT_SHIP_BASE_COMMIT`), and commits what it leaves behind only once your own gates have passed against it. A non-zero exit blocks the ship with the command's own output. No default. |
| `ship.allow-no-ci`    |       no | When `true`, a pull request whose check list is readable and genuinely empty may merge after the usual one-minute registration grace. Defaults to `false`: ship waits up to thirty minutes for checks to appear and then blocks with `checks-missing`. It applies only to ABSENT checks — a failed, pending, unreadable or wrong-commit check is enforced exactly as it always was — and lightsout never sets it for you. |

Set `allow-no-ci` only for a repository that intentionally has no CI:

```jsonc
"ship": { "allow-no-ci": true }
```

A branch a work order claims — the work order whose record saves that branch —
merges only when that record authorizes it: a `single-plan` ticket once plan 001
is implemented — or, when it holds no plan 001, once the queue's build from the
ticket body is recorded as passed — and a `multiple-plan` ticket once an explicit
ship request naming its included plans is satisfied. The record is asked twice — before anything is
pushed, and again immediately before the merge, so a plan added while the checks
were running still stops it — and a refusal is written as a blocked result with
reason `ticket-not-authorized` and one sentence saying what the ticket is waiting
for. A published record that diverged from this machine's copy, or one that could
not be read, blocks the same way. A branch no work order claims merges exactly as
it did before work orders existed.

This block is where branch-to-ticket and pull-request conventions live; the
tracker connection lives in `ticket-tracker` below. A work order's folder label
and the branch it implements on are two separate fields, written together by
`lightsout work-order new` and neither built from the other, so a template
carrying a prefix gives a branch such as `feature/lo-140-multi` beside a folder
still labelled `lo-140-multi`; the record is what links them, and the
`ticket-workflow` skill's `## Plan folder` is where the rules for it live. The
default body is deliberately inert — a body that closes a ticket automatically is a
team's convention, not the engine's. The block is strict: an unknown key fails
parsing rather than silently disabling a setting you believe is on.

### Ticket tracker settings

The `ticket-tracker` block says who the engine talks to about a ticket. Every
command that reads or writes one resolves the same block, so the connection is
spelled once rather than once per command. It is discriminated by `provider`:
Linear and Jira share the provider and API-key fields, then require only the
connection fields that belong to that provider.

| Field                                      | Required | What it controls                                                                                                                                       |
| ------------------------------------------ | -------: | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ticket-tracker.provider`                  |      yes | Which tracker the engine talks to: `linear` or `jira`. This selects the rest of the block's shape.                                                      |
| `ticket-tracker.api-key-env`               |      yes | Name of the environment variable holding the Linear API key or Jira API token. The credential itself is never written to config.                       |
| `ticket-tracker.team`                      |   linear | The Linear team key, e.g. `LO`. Every Linear query is scoped to it.                                                                                     |
| `ticket-tracker.site-url`                  |     jira | HTTPS Jira Cloud origin ending in `.atlassian.net`, with no path, query, or fragment.                                                                   |
| `ticket-tracker.project`                   |     jira | Jira project key, e.g. `LO`; it scopes Jira queries and ticket identifiers.                                                                             |
| `ticket-tracker.api-user-email-env`        |     jira | Name of the environment variable holding the Jira account email used with the API token. The email itself is never written to config.                  |

The block is strict for the same reason `ship` is: an unknown key, including a
field from the other provider's shape, fails parsing rather than silently
disabling a setting you believe is on. `lightsout queue` requires both this
block and `queue`, and reports which one is absent. Credential values never live
in the file; only the names of the environment variables that hold them do.

The values themselves can sit in a gitignored `.env` at the repository root.
Every command loads that file before it reads the environment, and a command run
from a linked worktree reads the primary checkout's `.env`, because a worktree is
a fresh checkout and carries none. A variable already exported always wins over
the file, so a CI secret or a `--env-file` on the command line is never
overwritten.

Jira Cloud uses a Basic-auth API token and account email. Keep both values in
the environment, never in configuration:

```sh
export JIRA_API_TOKEN='your-api-token'
export JIRA_ACCOUNT_EMAIL='you@example.com'
```

```json
{
  "ticket-tracker": {
    "provider": "jira",
    "site-url": "https://example.atlassian.net",
    "project": "LO",
    "api-key-env": "JIRA_API_TOKEN",
    "api-user-email-env": "JIRA_ACCOUNT_EMAIL"
  }
}
```

### Worktree settings

| Field            | Required | What it controls                                                                                         |
| ---------------- | -------: | -------------------------------------------------------------------------------------------------------- |
| `worktree.setup` |       no | Command run once in each fresh worktree before any agent, e.g. `pnpm install`. Absent means nothing runs. |

Both `lightsout queue` and an isolated implementation run cut a worktree of their
own, and both run this one command inside it before any agent starts — the queue
once per ticket, an implementation run once per run. That is why the key sits at
the top level rather than inside either block: it is the same command whoever
created the tree. A repository whose worktrees need no preparation declares no
block at all, and nothing runs. The block is strict for the same reason `ship`
is: an unknown key fails parsing rather than silently disabling a setting you
believe is on.

### Queue settings

The `queue` block is what `lightsout queue` runs on. Without it the command refuses to start. Only `max-parallel` is required; the rest have defaults. Who the queue talks to lives in `ticket-tracker` above.

| Field                    | Required | What it controls                                                                                                                                                                                                                                                            |
| ------------------------ | -------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `queue.planning-status-labels` |  no | The ticket label naming each planning status. Its five keys are `planning-needs-brainstorm`, `planning-needs-plan`, `planning-ready-auto-plan`, `planning-complete` and `planning-not-needed`; each is optional and defaults to the planning status spelled verbatim, so you override only the label your tracker spells differently. Exactly one of these labels on a ticket is the human's opt-in to automation — the queue never takes an unlabeled ticket. Two statuses may not share one label; the queue refuses at startup naming the repeated label. |
| `queue.max-parallel`     |      yes | How many tickets may be in flight at once. Also the ceiling on how many questions can ever wait for you at the same time. The merge lane occupies one of these slots while it rebases and re-runs the gates on a branch, so this is the ceiling on everything the queue runs at once, merges included. |
| `queue.eligible-statuses` |      no | Ticket statuses the queue may pick up. Defaults to `["Backlog", "Ready to implement"]`. Your ready status has to be one of them, or nothing waiting to be implemented is ever picked up.                                                                                     |
| `queue.ready-status`     |       no | Your tracker's name for the status a ticket waits at once its shaping is finished or was never needed. Defaults to `"Ready to implement"`. It must be one of `queue.eligible-statuses`, or the queue refuses at startup naming both keys.                                     |
| `queue.in-progress-status` |     no | Status the queue moves a ticket to when it picks it up. Defaults to `"In Progress"`.                                                                                                                                                                                        |
| `queue.done-status`      |       no | Your tracker's name for the status a ticket reaches once its merge is confirmed. Defaults to `"Done"`.                                                                                                                                                                       |
| `queue.branch-template`  |       no | How a ticket becomes a branch name. `{ticket}` is the lowercased identifier, `{slug}` the slugged title. Defaults to `{ticket}-{slug}`. Whatever it produces must be matched by `ship.ticket-pattern` wherever a ticket names the work. `lightsout work-order new` renders it once and saves the result in the work order's record; the folder's own label is saved separately, and a folder is found by the record that stores a branch rather than by slugging the branch itself. With no ticket, `{ticket}` and the separator that follows it simply drop.                                                                        |
| `queue.decisions-heading` |      no | The ticket-body heading relayed answers are appended under. Defaults to `## Decisions`.                                                                                                                                                                                     |
| `queue.worker-timeout`   |       no | Ceiling for one ticket's worker session, as a duration string like `90s`, `45m` or `4h`. Per ticket, never for the drain — the queue itself runs until the backlog is dry. A hit ceiling parks the ticket resumably. Defaults to `4h`.                                        |
| `queue.question-timeout` |       no | How long one relayed question waits for an answer before its ticket parks, as a duration string. Only `--file-relay` observes it; the terminal relay waits on the person at the terminal. Defaults to `1h`.                                                                   |
| `queue.parked-label`     |       no | The ticket label the queue sets when a ticket parks and clears when it resumes or ships. It is cleared from a ticket the queue leaves open too: that ticket is waiting on a human decision rather than parked. Opt-in with no default. Linear creates the team label on first use; Jira updates issue labels directly. |

The block is strict for the same reason `ship` is: an unknown key fails parsing
rather than silently disabling a setting you believe is on. It contains queue
behaviour only — planning-status labels, tracker status names, parallelism, and
timeouts. The tracker connection lives only in `ticket-tracker`, and the command
that prepares a fresh worktree lives only in `worktree`.

The queue reads two things about a ticket — the planning status its label names,
and the status the ticket sits at — and takes work from exactly three pairs:

| Planning status | Tracker status | What runs |
| --- | --- | --- |
| `planning-ready-auto-plan` | Backlog | the engine picks which plan of the ticket is planned first, then implements it |
| `planning-complete` | Ready to implement | the ticket's plans that are ready to implement are implemented in numeric order |
| `planning-not-needed` | Ready to implement | the ticket body is built straight |

Every other combination is left alone. `planning-needs-brainstorm` and
`planning-needs-plan` are the states a human is still shaping, and a
`planning-not-needed` ticket still in Backlog is not moved — putting a ticket
into Ready to implement is the shaping workflow's job. Backlog here means any
eligible status that is not your ready status.

A ticket whose record is `multiple-plan` and whose ship request is not satisfied
is left **open** rather than parked: it takes no parked label, its tracker status
is left alone, and it does not make the drain exit 2. Every later drain looks at
it again and builds whichever of its plans have since become ready to implement,
or ships it once its request is satisfied.

### Plan settings

| Field                                  | Required | What it controls                                                                                                                                            |
| -------------------------------------- | -------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plan.default-work-order-mode`         |       no | The mode a work order's own record is created with: `single-plan` or `multiple-plan`. Defaults to `single-plan`. The queue creates the record of a ticket it builds from the ticket body in `single-plan` mode whatever this says. |
| `plan.contract`                        |       no | When true, plans are written as contracts carrying an acceptance-test ledger, the structural lint requires that ledger, and `plan grade` weighs each plan file and spawns readers only for the heavy ones. Defaults to `false`. |
| `plan.weight-thresholds.created-files` |       no | A plan file creating more source files than this is heavy. Defaults to `3`.                                                                                  |
| `plan.weight-thresholds.packages`      |       no | A plan file touching more packages than this is heavy. Defaults to `1`.                                                                                      |
| `plan.worktree`                        |       no | Whether a planning session works in its own isolated git worktree rather than the checkout it was launched from. Defaults to `true`.                        |

`plan.default-work-order-mode` only seeds the mode saved on a work order's own
record, at the moment that record is created. In `single-plan` mode plan 001
alone supplies the work order's implementation — that one plan may still have
phases — and `ship.after-implement` applies exactly as it always has; a
`single-plan` work order holding no plan 001 is implemented by the queue's
build from the ticket body instead. In
`multiple-plan` mode the work order's plans implement in numeric order on its
one branch, and the work order ships only when an explicit ship request naming
the included plans is satisfied. Changing the key never changes a work order
that already has a record; `lightsout work-order mode` does that, one work
order at a time. The queue creates the record of a ticket it builds from the
ticket body — a `planning-not-needed` ticket, or a `planning-complete` ticket
with no record yet — in `single-plan` mode whatever the key says, so such a
ticket ships once its build passed in every repository. What each mode means
for the work order, and what switching between them costs, is the
`ticket-workflow` skill's `### Modes`.

A planning session works in a git worktree of its own by default, so work
another agent does in the checkout you launched it from cannot move the code a
grade is measured against — a reusable passing grade stays reusable. The tree
sits at the branch's usual worktree path, on a branch named after the plan, cut
from the launching checkout's committed `HEAD` — never its uncommitted edits —
and that commit is recorded so a re-created tree starts from the same one. Any
plan folder already in the launching checkout, such as a brainstorm's notes and
decisions, is copied in and left where it was. `--worktree` and `--no-worktree`
override the setting for one command; supplying both is a startup failure. The
tree planning establishes is the one the implementation run continues in, and a
finished plan is copied back into the primary checkout before the shipped tree
is cleaned up.

Name a plan by its address — `<work-order>/<NNN-slug>` — and the tree and its
branch are the work order's rather than the plan's, read from the branch its
record saves, so every plan of one work order is planned and built in the one
tree on the one branch. A later plan continues in that tree when its ownership
record names a plan, queue or implementation run, and is refused while a live run
holds it, naming the run. With no tree, an existing branch is adopted at its own
tip, so a later plan reads the implementation already on it; when only the pushed
`origin/<branch>` exists, the tree is cut at that pushed commit, and a local
branch that is behind the pushed one is fast-forwarded when no tree holds it and
reported otherwise. Nothing is fetched to work any of that out — implementation
commits travel by `git push` and `git fetch` alone. Plan folders are copied into
and out of the tree one plan at a time, and a shipped tree's whole work order
folder is copied back to the primary checkout before the tree comes down, so no
sibling plan is lost with it.

A contract plan carries what a test cannot detect — the file map, the full
exported signatures of every created file, the file each new file mirrors, and
the decisions — plus an `## Acceptance Tests` table with one row per acceptance
criterion: the criterion, the test file that states it, the exact test name, and
the gate that runs it. Behaviour a plan used to narrate in prose becomes a row.
The contract shape is its own plan template, chosen by `plan.contract`, and a
criterion in it names the inputs, the condition that makes the case distinct, the
expected result and the failure case the test pins.
A file whose behaviour no test can state — a document, a config file — is listed
under `## Prose Files` with the reason, and stays described in words.

A rename-only plan or phase — one with a `## Renames` section, one old text and
new text per bullet — keeps the `## Acceptance Tests` heading but states no rows,
and is asked for none: a rename adds no behaviour a new test could state. In a
phased plan the overview repeats the declaration as a `- **Renames only:** yes`
bullet in that phase's declaration block, and the lint requires it to agree with
the phase file.

A move-folders-and-files plan or phase — one with a `## Build Mode` section
reading `move-folders-and-files` — keeps the `## Acceptance Tests` heading but
states no rows, and is asked for none: a move adds no behaviour a new test could
state. In a phased plan the overview repeats the declaration as a
`- **Moves folders and files only:** yes` bullet in that phase's declaration
block, which the engine keeps in agreement with the phase file.

A plan file is weighed from its own counts: it is heavy when it creates more
source files than `created-files`, when it touches more packages than
`packages`, or when it names no pattern to mirror. A heavy file gets the reader
fan-out once; a light one gets the structural lint and the ledger check and no
agent at all. `plan grade` prints each file's weight and every threshold it
crossed, and records both in `grade.json`.

`plan grade` also decides for itself how far each pass reaches, and none of that
is configurable — there is no key for it. It stops before spawning any agent when
the structural lint returns a blocking finding, because those findings alone
already put the plan below A. It keeps one record per judged finding in
`grade-memory.json` in the plan folder, which travels with a published plan and
comes back with a restore: a question already settled is not investigated again,
and one nobody has verified as answered keeps blocking even when a later reader
does not report it. A re-grade after a repair reads the edited phase files and
every phase connected to them, falling back to the whole plan whenever that set
cannot be established. A repair review that finished every check its own scope
called for becomes the comparison point the next repair narrows against, so a
phase whose current text was already checked is not read again. The same record
decides approval: a pass passes once every plan file is covered at its current
text — by that pass or by a recorded earlier one — and every finding is closed,
whatever that pass itself read. A change to the code, standards, configuration,
prompts or model drops the whole record and costs one full re-baseline, and a
review already covering the current plan text, code, standards, configuration,
prompts and model is reported as current rather than run again — deleting
`grade-memory.json`, which holds the coverage record as well as the findings, is
how a new baseline is forced.

The block is strict for the same reason `ship` is: an unknown key fails parsing
rather than silently disabling a setting you believe is on. Omit the block and
nothing changes — the same template, the same required sections, and every plan
file read by every lens.

### Implement settings

| Field                            | Required | What it controls                                                                                                                        |
| -------------------------------- | -------: | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `implement.worktree`             |       no | Whether an implementation run builds in its own isolated git worktree rather than the checkout it was launched from. Defaults to `true`. |
| `implement.refactor.max-rounds`  |       no | How many cleanup executor rounds one implementation run may spend at most. Defaults to `2`.                                             |

An implementation run builds in a git worktree of its own by default, so the
checkout you launched it from stays yours to work in. `--worktree` and
`--no-worktree` override the setting for one run; supplying both is a startup
failure, before any implementation begins. Whichever way it resolves, the run
names the workspace and the branch it chose before it starts.

A cleanup round is one invocation of the cleanup agent at the end of an
implementation run: it is handed the standards findings that qualify as this
run's own work, it edits, and the deterministic checks are run again over what
it changed.

The budget is a maximum, not a target. Cleanup stops as soon as nothing
qualifying is left, and it never starts at all when there was nothing to hand
the agent — a run that leaves the code clean spends no rounds however high this
number is. What may spend a round is narrow: a deterministic blocking finding
that this run's own edits introduced, or one whose measured size this run made
worse. Debt the run inherited, a finding whose provenance cannot be established,
and the agent review's opinions are all recorded and handed forward without
buying an attempt.

Whatever cleanup leaves behind never stops the run. Remaining findings are
written into the run report and the run carries on to its normal verification,
which has its own separate repair budget. Raise this number to buy more tidying
time per run; lower it to spend less. Turning cleanup off entirely is what the
skip control does, which is why `0` is refused rather than read as "no cleanup".

The block is strict for the same reason `ship` and `plan` are: an unknown key
fails parsing rather than silently leaving the default budget in force while
your config file believes it raised it.

### Pricing settings

| Field                        | Required | What it controls                                                                            |
| ---------------------------- | -------: | ------------------------------------------------------------------------------------------- |
| `pricing.<model>.input`      |      yes | US dollars per million input tokens for that model.                                          |
| `pricing.<model>.output`     |      yes | US dollars per million output tokens.                                                        |
| `pricing.<model>.cache-read` |      yes | US dollars per million tokens read from the prompt cache.                                    |
| `pricing.<model>.cache-write`|      yes | US dollars per million tokens written to the prompt cache.                                   |

```json
{
	"pricing": {
		"claude-opus-5": {
			"input": 15,
			"output": 75,
			"cache-read": 1.5,
			"cache-write": 18.75
		}
	}
}
```

The block is keyed by the model identifier a harness was invoked with — the same
string you would put in the top-level `model` key, or in a `commands` entry. Each
entry gives one rate per token count the activity record carries, so no rate can
be applied to a count it does not match, and every rate is dollars per million
tokens because that is the unit harness vendors publish: you copy the published
number rather than converting it.

It buys exactly one thing, and only in `lightsout report`: a separate column,
labelled as an estimate, holding those rates applied to the tokens the record
already holds. Every other figure in that report is something a harness itself
stated.

Nothing computed from this block is ever written to disk. The activity record
stores the tokens a process reported and the cost only when the harness stated
one, so the saved record stays provable years later whatever you do to these
rates. A model this block does not name shows no estimate rather than an
estimate of zero — a rate nobody stated cannot be guessed at, and a zero there
would be indistinguishable from an agent that really did spend nothing.

The block is optional and has no default. A repository that configures no rates
still gets the whole report and loses only that column. Each entry is strict for
the same reason `ship` and `plan` are: a misspelled rate name fails parsing
rather than silently leaving that token count unpriced while the column still
prints a total.

### Auto-plan settings

| Field                            | Required | What it controls                                                                                                                                                                       |
| -------------------------------- | -------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auto-plan.propose-before-draft` |       no | When true, the proposal comes before the plan is drafted and carries the design shape rather than the finished plan. Defaults to `false`, where the proposal shows the real, graded plan. |
| `auto-plan.implement-on-approval` |       no | When true, an approved proposal starts `/implement` rather than stopping at the hand-off line. Defaults to `false`: auto-plan only plans. Ignored under `lightsout queue`, where the auto-plan worker stops at the published plan and the engine runs the build itself.                                                |
| `auto-plan.auto-approve-plan`    |       no | When true, the proposal is skipped entirely, provided nothing cleared the escalation bar; a question that clears it parks the run instead of being guessed past. Defaults to `false`.    |

Every key is off by default, so an absent block is the most supervised behaviour there is — the skill plans the whole ticket, shows one proposal, and stops. Turning a key on is a repository saying the factory may carry on that far without asking. The block is strict for the same reason `ship` is.

### Docs settings

| Field | Required | What it controls |
| --------------- | -------: | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `docs[].path`   |      yes | Repo-relative path of a document the plan-time documentation check may name, e.g. `docs/configuration.md`.                                 |
| `docs[].covers` |      yes | One line saying what that document is responsible for. This is what tells a drafter where a given kind of change belongs.                  |

```json
{
	"docs": [
		{
			"path": "README.md",
			"covers": "The product tour: what lightsout is, what each command does, the walkthrough of a run, and the index of every other document."
		},
		{
			"path": "docs/configuration.md",
			"covers": "Every lightsout.config.json key: the generated top-level table, and the hand-written prose for each block and its keys."
		},
		{
			"path": "docs/monorepos.md",
			"covers": "How a monorepo is configured: the packages directory, scoped gate templates, and how a run picks the packages a change touched."
		}
	]
}
```

The block is entirely opt-in. Omit it and nothing changes: no `## Documentation`
section is required, no prompt text is added, no checker is spawned, and you are
never asked a new question.

Declare it and four seams switch on together. The plan writer is briefed on your
surfaces. The plan template asks every implementable plan file — a single plan,
and each phase file — for a `## Documentation` section stating either the
declared documents that plan touches or the exact sentence
`Nothing user-facing — no docs needed.` The structural lint requires that
section. And `plan grade` runs one whole-plan checker that verifies the stated
claim, reporting a blocking gap when a plan adds user-facing surface and touches
none of your declared documents.

The engine standardizes the question only — "does this plan touch a declared
surface?" — never a document's format, tone or structure. It never writes a
document, never judges its wording, and never opens one during the check.

At least one entry is required: an empty array would mean "declared, but
nothing", which opts into a check that can never fire. Each entry is strict for
the same reason `ship` is — a misspelled key fails parsing rather than silently
declaring a surface with no description.

### Harness-neutral keys

Two rules govern the keys above, and this surface depends on both:

- A key with a neutral name must mean the same thing on every harness. A capability only one harness has never gets a neutral key, because a key that reads as portable but silently does nothing is a failure you cannot see. If such a capability is ever needed, it goes under an explicitly harness-scoped block.
- `permissions` expresses intent, not identical enforcement. On Claude Code the commands granted through `agent-commands` are enforced by the harness itself. On Codex the workspace-write sandbox already permits commands, so the grant list the engine injects into the agent's prompt is what binds. On the pi-family harnesses the prompt grant is also what binds: `pi` has no permission system at all, and `omp`'s per-prefix grant would have to ride a config overlay that replaces the user's own command rules wholesale — not additive, so the engine does not use it. Under `omp`, `write` maps onto its approval tiers (file edits approved, command execution rejected headlessly) and `full-access` onto `yolo`; under `pi` both ride the prompt alone. The engine's own self-check rides that same per-spawn grant on every harness — harness-enforced on Claude Code, prompt-enforced elsewhere — because it is granted exactly as `agent-commands` is: one prefix appended to the allowance, and one section in the agent's prompt.

## Complete example

The following example shows how the optional configuration fields fit together:

```jsonc
{
  // Default harness, model, effort, and permissions
  "harness": "claude-code",
  "model": "opus",
  "effort": "high",
  "permissions": "full-access",

  // Per-command harness overrides
  "commands": {
    "plan": {
      "harness": "claude-code",
      "model": "claude-opus-5",
      "effort": "max",
    },
    "implement": {
      "harness": "claude-code",
      "model": "claude-sonnet-5",
    },
  },

  // The standards for the repository root and every package not named below;
  // without this key lightsout runs with no standards
  "standards-pack": "lightsout/standards",

  // A package whose standards differ, keyed by its folder under packages-dir
  "package-standards-packs": {
    "docs-site": "lightsout/code-style",
  },

  // Repository-wide gates
  "gates": {
    "check": "pnpm check",
    "test": "pnpm test:unit",
    "test-coverage": "pnpm test:unit:coverage",
    "generate": "pnpm prisma:generate",
    "build": "pnpm build",
    "format": "pnpm format:write",
  },

  // Per-package gates for monorepos
  "packages-dir": "packages",
  "package-gates": {
    "check": "pnpm --filter {package} check",
    "test": "pnpm --filter {package} test:unit",
    "test-coverage": "pnpm --filter {package} test:unit:coverage",
    "build": "pnpm --filter {package} build",
  },

  // Which gates run at a given verification checkpoint.
  // An unlisted checkpoint keeps the engine's own two tiers.
  "gate-overrides": {
    "verify-implement": ["check", "test"],
    "verify-refactor": "off",
  },

  // Commands implementation agents may run
  "agent-commands": ["pnpm --filter api run prisma:migrate:dev:name"],

  // Generated files excluded from changed-file attribution
  "generated": ["src/generated/", "src/schema.gql"],

  // Third-party code the repo vendors: never checked, still attributed
  "vendored": ["src/common/components/ui/"],

  // Agent and supervisor limits
  "timeouts": {
    "agent-minutes": 60,
    "supervisor-minutes": 15,
  },

  // Ship: how a branch reaches merged, and what its pull request says
  "ship": {
    "ticket-pattern": "^(?<ticket>[a-z]+-(?<number>\\d+))",
    "pr-body": "Closes ABC-{number}",
    "merge-method": "merge",
    "after-implement": false,
    "pre-ship": "node scripts/make-tree-shippable.mjs",
    "allow-no-ci": false,
  },

  // Ticket tracker: who the engine talks to about a ticket
  "ticket-tracker": {
    "provider": "linear",
    "team": "ABC",
    "api-key-env": "LINEAR_API_KEY",
  },

  // Worktree: the one command run inside every fresh worktree, by the queue
  // and by an isolated implementation run alike
  "worktree": {
    "setup": "pnpm install",
  },

  // Queue: which tickets to drain, and how many run at once.
  // The five planning-status labels and the four status names all default, so
  // a repository whose tracker spells them the same way configures none of them.
  "queue": {
    "max-parallel": 2,
    "worker-timeout": "4h",
    "question-timeout": "1h",
    "parked-label": "queue-parked",
  },

  // Auto-plan: which of /auto-plan's checkpoints this repo keeps
  "auto-plan": {
    "propose-before-draft": true,
    "auto-approve-plan": true,
    "implement-on-approval": true,
  },

  // Documentation surfaces the plan check may name
  "docs": [
    {
      "path": "README.md",
      "covers": "The product tour, and the index of every other document.",
    },
    {
      "path": "docs/configuration.md",
      "covers": "Every configuration key, and the prose for each block.",
    },
  ],

  // Per-rule standards-check overrides
  "standards-rule-settings": {
    // Our linter already enforces this one.
    "filename-mismatch": "off",
    // Ask for a longer duplicated stretch before it counts.
    "duplicate-code-block": { "options": { "minTokens": 70 } },
    // .tsx files here carry more JSX than the default budget assumes.
    "file-size": { "options": { "tsxFile": 400 } },
  },
}
```

## Recommended `.gitignore`

Commit your configuration and standards. Ignore the state directory whole —
nothing lightsout writes under it is meant to be tracked:

```gitignore
.lightsout
```
