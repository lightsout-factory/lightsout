# @lightsout/standards-typescript — authoring notes

This package is the default standards pack: the documents lightsout hands an
agent, and the rules it checks a repository against. A document folder holds a
`document.md` and one folder per rule, each named `<NN>-<id>` — `rule.md` is
required, `check.ts` and `fixtures/` are optional. `<NN>` decides the order the
rules read in and nothing else; the `<id>` — everything after the first dash
group, per
`packages/engine/src/standardsPacks/internal/common/parsing/parseRuleFolder.ts:59` — is
the rule's durable key. It is what a finding is written with, what a repository
names in `standards-checks`, and what a frozen refactor work-list holds, so it
outlives the folder it came from.

This file is authoring notes only. `scripts/copyStandards.mjs` lists
`README.md` in its `authoringFiles` set, so a README at the pack root never
reaches the shipped `plugin/standards/` bundle.

## Rule Id Naming Convention

1. **An id names the topic the rule covers, in plain words** — specific enough
   that a reader knows what it covers without opening it. Not the mechanism
   that finds a break, not the input the check reads, not the remedy the fix
   applies. `clone` names a detector; `module-file-to-folder` names what the
   rule decides.
2. **One style for every rule, however it is checked.** Whether an agent or a
   `check.ts` enforces it shows as a tag on the rule's page, not in its id, so
   a rule that gains or loses a check keeps its name. No lint-style `no-` or
   `prefer-` prefixes: a rule is guidance, not a yes-or-no switch.
3. **Kebab-case, two to five words, no term a reader outside this project would
   have to look up.** `ast`, `census`, `mega`, `clone` all fail this.
4. **A prefix is allowed only when it names the subject the defect is about**,
   and only where the pack already reads that way: `test-` (a defect in a test
   file), `barrel-`, `class-`, `duplicate-`. A prefix that names the check's
   plumbing is banned — this is what retires `path-`.
5. **The id must not read as the opposite of what it enforces.**
   `index-not-barrel` fails: the rule requires an index file to *be* a barrel.
6. **Word order follows English.** The defect is a noun phrase read left to
   right: `duplicate-export-name`, not `name-duplicate`; `folder-size`, not
   `folder-census`. An id that reads as a database column name fails.
7. **A word the id shares with its document folder is not automatically
   redundant.** Ids are read in flat lists — config keys, findings output, the
   `durableRuleIds` ledger — where no folder is around them, so
   `test-in-tests-folder` earns its `test-`: without it the id could describe
   any file. Drop the shared word only when the rest of the id already implies
   it, which is why `test-mega-factory` became `oversized-setup-factory` — a
   setup factory is a test-only thing and the word buys nothing.
8. **An id is durable once shipped.** Renaming one resets every persisted
   finding keyed to it. Get it right at birth; a rename is a deliberate change
   that migrates the config, the engine's id lists and the pack's cross-links in
   the same commit.

## Writing a Rule's Prose

**Summary** — the `summary` in a rule's front matter is one short sentence
saying what the rule is about, for a person deciding at a glance whether it
makes sense. Agents never read it; they read the prose. State the topic at a
high level, not the mistake in detail — the details belong in the prose. No
jargon, no mechanism (`token-level`, `after identifier normalization`, `AST`),
no tool names, no settings keys, no numbers. Pages print it as written, so it
starts with a capital letter and ends with a full stop.

- before: `"a folder created for a concept with no private companions, or a folder's internals reached from outside it"`
- after: `"When a module should stay one file, and when it should become a folder."`

**Prose** — the prose is the rule itself. Agents follow this exact text when
they write and review code, and the rule page prints the same text under "The
rule", so it has to be clear enough to hand straight to an agent and readable
enough for a person to agree with. One rule, one job: leave out anything
another rule already covers. Plain sentences, the reason stated before the mandate, second
person or plain declarative, no jargon left undefined on the page. The register
is set by `tests/unit-testing/04-module-boundary-testing/rule.md`: it opens with
what to do by default, gives the reason in the same breath ("so a module's
internals can be reorganized without touching a single test"), then lists the
carve-outs.

**Printed finding text** — the `detail` and `guidance` strings a `check.ts`
emits are what a person reads when the rule fires, so they take the same plain
register: no mechanism jargon, no tool names. The no-numbers and
no-settings-keys clauses are summary-only and do NOT apply here — a finding's
interpolated measurement (`${lineCount} lines (cap ~${cap})`), its observed
value, and the settings key its guidance names are the actionable part of the
finding, and they stay.

## A Rule's Examples

A rule's `fixtures/fail/` and `fixtures/pass/` are what `lightsout
standards-validate` runs its check against, and what the rule's page shows as
its Incorrect and Correct examples. `example` in the front matter says how they
are shaped, which decides how the page shows them:

- `kind: snippet` — one file a side, each read on its own.
- `kind: repo` — a small source tree a side, because the rule looks across files
  and no single file shows the defect. `focus` names the file each side opens
  on: the one that shows the defect, and the one that shows its fix. Supporting
  files — a `package.json` the check reads, the module that imports another —
  stay in the tree without leading it.

```yaml
example:
  kind: repo
  focus:
    fail: src/feature/buildGreeting.ts
    pass: src/index.ts
```

`standards-validate` holds the fixtures to the declared shape: a snippet with
more than one file a side, or a `focus` file its side does not hold, is a
problem. A rule that declares nothing is shown by its files — one file or none a
side as a snippet, anything more as a repo opening on each side's first file —
which is what a pack written before this key exists gets.

Comments in a fixture are half of what it teaches, so every file a reader might
open says why it is there. Mind what a comment names: a check that counts
mentions, like `dead-export`'s, reads a comment's words as uses.

## Renaming a Rule

A rename resets every persisted finding keyed to the old id: baselines,
snapshots and frozen work-lists under `.lightsout/` are written with the id in
them and are not migrated. Do it deliberately, and migrate all of this in one
change:

- the rule's folder — `<NN>-<old-id>` to `<NN>-<new-id>`, keeping `<NN>`
- the rule's own `check.ts` (the `rule:` string and any prose naming the id),
  its `check.unit.test.ts` (site keys, `describe` titles, asserted strings) and
  its `fixtures/pass/package.json` name
- sibling `rule.md` and `document.md` files that cross-link into the folder, and
  their link text where it names the old id
- `lightsout.config.json` — its `standards-checks` block is alphabetically
  sorted, so re-sort after renaming
- `docs/configuration.md` — the `standards-checks` example, the strict-profile
  block (a key-for-key copy of `lightsout.config.json`, sorted the same way) and
  the full-config sample
- `packages/engine/src/refactor/batch/batchFindings.ts` — `rulePriority`
  renames in place; its order is engine pacing policy, not a fact about the rule
- `packages/engine/tests/helpers/strictProfile.ts` — alphabetically sorted, so
  re-sort after renaming
- the `durableRuleIds` ledger in
  `packages/engine/src/standardsCheck/listStandardsRules.unit.test.ts`, whose
  docblock records what changed and when, so a missing id reads as a rename
  rather than a retirement

Then verify mechanically: `git grep -w <old-id>` over tracked files, excluding
`plugin/` (regenerated by `pnpm bundle`), returns nothing.
