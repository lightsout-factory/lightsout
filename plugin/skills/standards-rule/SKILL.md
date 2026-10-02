---
name: standards-rule
description: Write a new rule for a lightsout standards library, or review and rewrite an existing one — its name, summary, prose, examples and finding text. Use when the user asks to add, create, review, rename, reword or clean up a standards rule.
---

# lightsout: standards-rule

A standards library is where lightsout's rules for writing code are defined,
and a pack picks which of them a repository uses. This skill writes one rule,
or reviews one, so every rule in every library has the same shape.

## How a library is built

- **Library:** a folder holding `lightsout-standards.json` (`name`,
  `formatVersion: 2`, and an optional `description` and `homepage`), a
  `rules/` folder with `code/` for the agents that write code and `tests/` for
  the agent that writes tests, and a `packs/` folder. A repository registers a
  library of its own in `standards-libraries` in its lightsout config, under
  the same name as the manifest's `name`. `lightsout` is the built-in library,
  and its name is reserved. Checks load as ES modules, so the library's
  `package.json` says `"type": "module"`. Helpers several checks share can live
  in `common/`, imported through an `imports` entry such as `#common/*`, as the
  built-in library does.
- **Topic:** a folder under `rules/code/` or `rules/tests/` that holds a
  `topic.md`, plus one folder per rule. It covers one subject, such as error
  handling or naming. Its `topic.md` is a title and the background every rule
  in it shares, said once. Folders without a `topic.md` only group topics. A
  topic is addressed as `<library>/<path under rules/>`, such as
  `lightsout/code/architecture/react`.
- **Rule:** a folder named `<NN>-<id>`. `<NN>` sets only the reading order. The
  `<id>` is the rule's key, and its full name is `<library>/<id>`. Findings are
  written with the full name. A short id is accepted wherever it is unique.
  - `rule.md` — required: front matter, then the prose.
  - `check.ts` — optional: code that finds breaks. Declare `checked: true` when
    it exists, and only then.
  - `fixtures/fail/` and `fixtures/pass/` — the Incorrect and Correct examples.
- **Pack:** one JSON file in `packs/`, addressed as
  `<library>/<file name without .json>`. It holds a `description`;
  `include.packs`, `include.topics` and `include.rules`, which all add; and
  `rule-settings`, which gives a rule in the pack a severity, or a `severity`
  and `options` (`off` removes the rule). A pack changes which rules apply and
  how they are graded, never a rule's text or check. When two included packs
  disagree about a rule, the last one listed wins. A pack may declare
  `applies-when` with a list of `dependencies`: it then reaches only the
  packages whose own `package.json` declares one of them, which is how a
  framework's rules stay out of packages that do not use it.
- **How a repository picks standards:** `standards-pack` names the pack, or a
  list of packs, for the repository, `package-standards-packs` names them for
  each package that differs, and `standards-rule-settings` is the final layer
  over both. Standards are opt-in: with no pack named, a repository has none.

`rule.md` front matter:

```yaml
summary: "One short sentence for people."   # required
checked: false                              # true only with a check.ts
severity: advisory                          # blocking | advisory | off (off = a repo opts in)
options:                                    # numbers the check reads, if any
  cap: 20
example:
  kind: snippet                             # or repo, with focus
requires:                                   # rules this rule depends on: a short id in this library, the full name for another
  - folder-index-file
```

A `requires` name that matches no rule fails loading. `standards-validate`
warns when a pack in the library leaves out a required rule, and `lightsout
doctor` warns a repository the same way.

**Who reads what.** An agent reads one topic at a time: the `topic.md`
background, then the prose of every rule in it, in folder order. It never sees
the summary or the examples. People see the summary, the prose and the
examples on the rule's page.

## Steps

1. **Find the library and the topic, or create them.** The library root is the
   folder holding `lightsout-standards.json`. Read the topic's `topic.md` and
   every rule in it, because the agent reads them together.
   - **No library yet:** create a folder with a `lightsout-standards.json` and
     a `rules/` folder holding `code/` or `tests/`:

     ```json
     { "name": "house-rules", "formatVersion": 2, "description": "What this team agrees on." }
     ```

     Then register the folder in `standards-libraries` in the repository's
     lightsout config, under the manifest's `name`, so lightsout loads it.
   - **No topic for the rule's subject:** create a folder for it, such as
     `rules/code/error-handling/`, with a `topic.md` holding a heading and one
     line on what the topic covers.

2. **Decide the rule's one job.** A rule is one decision. To decide where one
   rule ends, ask: could a repo want this rule without the one next to it? If
   yes, they are two rules; if no, they are one. If another rule already says
   it, change that rule instead of adding one. Background that several rules
   share goes in the `topic.md`, once.

3. **For an existing rule, list its instructions first.** See
   [Changing an existing rule](#changing-an-existing-rule). Do this before you
   write a word.

4. **Write the rule** — the name, summary, prose, examples and finding text,
   as the sections below say. Add `requires` when the rule only makes sense
   with another rule.

5. **Put the rule in a pack.** A rule in a topic that a pack already includes
   arrives with it. Otherwise add the topic to a pack file's `include.topics`,
   or the rule to its `include.rules`.

6. **Validate.** Resolve the plugin root from this loaded skill's absolute
   path: it is two directories above this `SKILL.md`. In Claude Code,
   `${CLAUDE_PLUGIN_ROOT}` may provide the same path; do not assume that
   variable exists in other harnesses. Then run:

   ```sh
   node "<plugin-root>/dist/cli.mjs" standards-validate --library <library-root>
   ```

   It runs every check against its own examples, checks each rule's declared
   example shape, checks every pack file, and warns about a required rule that
   will not reach agents. If the repo has its own tests for the library, run
   them too.

7. **Show the user, and wait.** Show the new rule, the instruction list for a
   changed rule, and every new instruction on its own. Commit only what the
   user approves.

## Name (the id)

1. **Name the topic the rule covers, in plain words**, specific enough that a
   reader knows what it covers without opening it. Not the mechanism that finds
   a break, not the input a check reads, not the fix. `import-scanner` names a
   detector; `import-from-declaring-file` names what the rule decides.
2. **The name says what kind of rule it is:**
   - `no-<thing>` when the rule is a ban.
   - `prefer-<thing>` when the rule is a default the model may depart from.
   - A topic name when the rule is a set of instructions, such as
     `module-file-to-folder`.

   A rule that gains or loses a code check keeps its name.
3. **Kebab-case, two to five words, no term a reader outside the project would
   have to look up.** Words like `ast` or `census` fail this.
4. **Use words engineers already know**, not labels a reader must learn:
   `helper-file-placement`, not `satellite-rule`.
5. **Any other prefix names the subject the rule is about**, such as `test-`
   for a rule about test files — never how the check works.
6. **The id must not read as the opposite of what it asks for.**
   `allow-default-export` fails for a rule that bans default exports; name it
   `no-default-export`.
7. **Word order follows English:** `duplicate-export-name`, not
   `name-duplicate`. An id that reads as a database column name fails.
8. **A word the id shares with its topic is not always a repeat.** Ids are
   read in flat lists, such as config keys and findings, with no folder around
   them. Drop the shared word only when the rest of the id already implies it.
9. **The prose's `##` heading is the id in words:**
   `import-from-declaring-file` reads "Import From Declaring File".
10. **An id is durable once shipped.** Renaming one resets every saved finding
    keyed to it. See [Renaming a rule](#renaming-a-rule).

## Summary

One short sentence saying what the rule is about, for a person deciding at a
glance whether it makes sense. Agents never read it.

- State the topic at a high level, not the mistake in detail.
- No jargon, no mechanism, no tool names, no option keys, no numbers.
- A capital letter at the start and a full stop at the end.

Before: `"a re-export resolved through an index instead of the declaring module"`.
After: `"Where an import should point."`

## Prose

The prose is the rule itself. Agents follow this exact text when they write and
review code, and the rule's page shows it under "The rule". It must be clear
enough to hand straight to an agent, and readable enough for a person to agree
with.

- **Fewest words that get the job done.** Agents load the prose on every task,
  so every word costs, but the job getting done comes first.
- **Plain words, written as instructions a new engineer could follow.** Plain
  language is not less exact for an agent; exact conditions are what make it
  exact.
- **Shape:** what to do, when it applies and its exceptions, then why in one
  short sentence. An agent uses the reason to decide cases the rule does not
  name.
- **Say what to do**, not only what is bad.
- **Write only what the model wouldn't do on its own.** It already knows the
  language and the usual edge cases. State the choice and the reason. Add an
  exception only when it is specific to this team, or when agents keep getting
  it wrong.
- **Cover both directions where they exist:** when to split something, and when
  to merge it back.
- **One rule, one job:** leave out anything another rule already covers.
- **Every link resolves** to a file that exists.

## Examples

`fixtures/fail/` and `fixtures/pass/` are the rule's Incorrect and Correct
examples. Agents never see them: their job is to make a person agree with the
rule in a few seconds. For a checked rule they are also its tests —
`standards-validate` fails when the check misses its fail example or flags its
pass example.

- **Show the whole rule, not half of it.** One example can show both halves.
- **Follow every other rule in the library**, so the correct side is correct
  everywhere.
- **Every file a reader might open has a short, accurate comment** saying what
  is wrong or right, and why.
- **Mind what a comment names:** a check that counts mentions reads a comment's
  words as uses. An edit to a checked rule's example, even to a comment, can
  break validation.

Declare the shape that shows the mistake in the front matter:

- `kind: snippet` — one file a side, each read on its own.
- `kind: repo` — a small file tree a side, when the rule is about files and
  folders or looks across files. `focus` names the file each side opens on:
  the one that shows the mistake, and the one that shows the fix. Supporting
  files, such as a `package.json` the check reads or the module that imports
  another, stay in the tree without leading it.

```yaml
example:
  kind: repo
  focus:
    fail: src/feature/buildGreeting.ts
    pass: src/index.ts
```

`standards-validate` holds the examples to the declared shape: a snippet with
more than one file a side, or a `focus` file its side does not hold, is a
problem. A rule that declares nothing is shown by its files: one file or none a
side as a snippet, anything more as a repo opening on each side's first file.

## Finding text

The `detail` and `guidance` strings a `check.ts` prints are what a person reads
when the rule fires, so they use the same plain words: no mechanism jargon, no
tool names. Unlike the summary, they keep numbers and option keys: the
measured value, the limit and the option to change are the useful part of a
finding.

## Changing an existing rule

A rewrite changes how a rule is said, never what it asks for, unless the
user approves the change.

1. Before you rewrite a rule, list every instruction in its old text, one per
   row.
2. After the rewrite, give each row a home: the rule and line where it lives
   now. Or remove it as a repeat, and quote the other rule that already says
   it. If you cannot quote it, it is not a repeat, and it stays.
3. A new instruction that fills a gap is allowed, but list it separately and get
   the user's approval before you commit.
4. Show the user the full list, old instruction to new home, before you
   commit.

## Renaming a rule

A rename resets every saved finding keyed to the old id, so rename on purpose.

- Rename the folder, keeping `<NN>`, and change the id everywhere it is
  written: the check, its tests, links from other rules and topics, every pack
  file that names it, every other rule's `requires` that names it, and any
  config that names it in `standards-rule-settings`.
- Renamed means renamed: keep no old names, aliases or "renamed to" messages.
- Then search every tracked file for the old id as a whole word. Nothing should
  match.
