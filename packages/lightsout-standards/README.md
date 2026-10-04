# @lightsout/lightsout-standards — authoring notes

This package is the built-in `lightsout` standards library: the topics
lightsout hands an agent, the rules it checks a repository against, and the
packs a repository picks those rules through.

This file is authoring notes only. `scripts/copyStandards.mjs` lists
`README.md` in its `authoringFiles` set, so a README at the library root never
reaches the shipped `plugin/standards/` bundle.

## Layout

The library root holds:

- `lightsout-standards.json` — the manifest: the library's name, `lightsout`,
  and its format version.
- `rules/` — the topics. `rules/code/` holds what the agents that write code
  read; `rules/tests/` holds what the agent that writes tests reads.
- `packs/` — one JSON file per pack.
- `common/` — helpers the checks share. A check imports one through the
  `#common/*` entry of this package's `imports`.

A topic is a folder holding a `topic.md` and one folder per rule, each named
`<NN>-<id>`. `rule.md` is required; `check.ts` and `fixtures/` are optional.
`checks:` names the rule's kind of check: `deterministic` when its `check.ts`
decides the whole rule, `agent` when it ships no `check.ts` and an agent reads
it, or `both` when the check finds only some of what the rule names and an
agent reads the rest.

## Names

`<NN>` decides the order the rules read in and nothing else. The `<id>` —
everything after the first dash group, as
`packages/engine/src/standardsLibraries/readStandardsLibrary/parseTopicFolder/parseRuleFolder/parseRuleFolder.ts`
derives it — is the rule's durable key, and its full name is `lightsout/<id>`.
Findings, baselines and frozen refactor work-lists are written with the full
name, so it outlives the folder it came from. A repository names a rule in
`standards-rule-settings`, and a pack file names it in `include.rules` or
`rule-settings`.

## Packs

Packs are grouped by what the rules are for, and the rule tree mirrors them:
`rules/code/<pack>/<topic>/` and `rules/tests/<pack>/`.

- `fractal` — keeps the repo the same shape at every level: modules, shared
  code, size caps, duplication and imports, plus where tests sit.
- `code-style` — one way to write a function, a class, a set of named values,
  a type-safe value and a unit test.
- `standards` — both packs above. It is the pack the docs tell a repository to
  opt into, and the one this repo runs for every package but the web app.
- `react`, `tanstack-start` — the rules written for one framework, under
  `rules/code/frameworks/` and `rules/tests/frameworks/`, and nothing else. A
  package selects them through `package-standards-packs`. The general rules
  know nothing about a framework, so a framework pack is where a framework's
  differences live. Neither holds a general rule yet: which of those a
  framework package also runs is still to be decided, and `react-function-size`
  replaces `function-size`, so the two never go to one package together.

`fractal` stands alone: no rule in it names, or `requires`, a rule in another
pack. `code-style` and the framework packs may refer to `fractal` rules.

The shipped packs carry no `rule-settings`, so every rule keeps the severity
and options its `rule.md` gives it. A new rule in an existing topic reaches
every pack that includes the topic. A new topic reaches no pack until a pack
file's `include.topics` names it.

## Writing and Reviewing Rules

The `standards-rule` skill, `plugin/skills/standards-rule/SKILL.md`, says how to
write or review a rule in any library: the name, summary, prose, examples,
finding text, changing an existing rule and renaming one. Follow it. This file
holds only what is particular to this library and this repo.

## In This Library

- **Prefixes this library uses:** `no-` (a ban), `prefer-` (a default), and
  subject prefixes: `test-` (a rule about a test file), `class-` and
  `duplicate-`. `path-` named how a check worked, and is retired.
- **Shared words:** ids are also read in the `durableRuleIds` ledger, so
  `test-beside-subject` keeps its `test-`. Word order: `folder-size`, not
  `folder-census`.
- **Framework topics:** a framework topic states what the framework mandates as fact, and this library's own conventions as conventions.
- **The model rule:**
  `rules/code/fractal/layout/15-module-file-to-folder/rule.md`
  sets the register for prose.
- **Shared helpers:** a check imports a helper from `common/` through
  `#common/*`, never by a relative path into `common/`.
- **Examples follow the library's own layout:** a file inside a module folder goes
  under `common/<type>/`, and each file has one export.
- **Comments in examples:** `dead-export`'s check counts mentions, so it reads a
  comment's words as uses.
- **Finding text:** a measured value stays in it, such as
  `${lineCount} lines (cap ~${cap})`.
- **Examples are tested here too:**
  `packages/engine/src/standardsCheck/validateStandardsLibrary.defaultPack.unit.test.ts`
  runs every check against its examples and checks each rule's declared shape.

## After Changing a Rule

1. `pnpm build:default-pack` — the web app reads the library from one bundled
   copy, `assets/default-pack.json`, and this rebuilds it so the rule's page
   shows the change.
2. Run the library tests: `pnpm test:unit -- src/standardsCheck/validateStandardsLibrary.defaultPack.unit.test.ts src/standardsLibraries`
   from `packages/engine`.
3. Note every other rule that still uses the rule's old name or words, and fix
   each when its own review reaches it.

## Naming a Rule

An id is short and says what the rule is about. It may name the mistake
(`multi-export`, `dead-export`, `case-collision`) or the instruction
(`object-args`, `prefer-functions`): an id named for the mistake reads well in
a list of findings, which is where ids are seen most. Rename an id only when it
is too long, unclear, or no longer true of the rule.

## Renaming a Rule

The skill's "Renaming a rule" applies. In this repo, baselines, snapshots and
frozen work-lists under `.lightsout/` are written with the full name in them
and are not migrated. Migrate all of this in one change:

- the rule's folder — `<NN>-<old-id>` to `<NN>-<new-id>`, keeping `<NN>`
- the rule's own `check.ts` (the `rule:` string and any prose naming the id),
  its `check.unit.test.ts` (site keys, `describe` titles, asserted strings) and
  its `fixtures/pass/package.json` name
- sibling `rule.md` and `topic.md` files that cross-link into the folder, and
  their link text where it names the old id
- every pack file in `packs/` that names the rule in `include.rules` or
  `rule-settings`
- every other rule's `requires:` list that names the rule
- `lightsout.config.json` — its `standards-rule-settings` block is
  alphabetically sorted, so re-sort after renaming
- `docs/configuration.md` — the `standards-rule-settings` example, the
  strict-profile block (a key-for-key copy of `lightsout.config.json`, sorted
  the same way) and the full-config sample
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
