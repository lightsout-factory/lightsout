---
name: auto-plan
description: Plan a ticket alone — self-answers every question below a written escalation bar, shows you one proposal, and rolls onward per the auto-plan config block. Use when the user asks to auto-plan a ticket, plan it without the interview, or hand a ticket straight to the factory. Input is a ticket, a feature description, or a rough-notes file path. Output feeds the `implement` skill.
allowed-tools: Bash, Read, Write, Edit, Grep, Glob, Task, WebSearch, WebFetch
---

# lightsout: auto-plan

**This skill is the interactive conductor, not the engine.** All determinism —
fact verification, the draft↔structural-lint loop, dedup detection, grading —
lives in the `lightsout plan …` subcommands as deterministic code. **Do not add
gates, retries, caps, or contract parsing here.** What is particular to this
skill: **it answers the questions the plan skill puts to the user, and stops
only at the checkpoints the config leaves standing.**

Resolve the plugin root once from this loaded skill's absolute path: it is two
directories above this `SKILL.md`. In Claude Code, `${CLAUDE_PLUGIN_ROOT}` may
provide the same path; do not assume that variable exists in Codex skill shell
calls. Use the resolved absolute path wherever `<plugin-root>` appears below.
Confirm `<plugin-root>/dist/cli.mjs` exists; otherwise stop and tell the user to
reinstall the plugin or run `pnpm bundle`.

## Shaping rules

**Read `<plugin-root>/skills/plan/shaping-rules.md` before step 0, and follow
it throughout.** It is the one copy of the rules this skill shares with `plan`
and `brainstorm`: how to recommend a design, the design check, the escalation
bar, how to flag a settled decision you believe is weak, and the Question
format. Its rules on recommending a design bind every self-answer, not only the
questions put to the user — most of this skill's answers are self-answers.

When this skill does put a question to the user — a checkpoint, a parked
question, a vetoed digest row — it uses that Question format, **one full-format
question per final response**. The proposal is the one exception: it carries
every pick and unresolved gap together, because it is read as one review
rather than answered one question at a time.

## The escalation bar

The bar is the shaping rules' `## The escalation bar`, applied to every
question this skill meets; a question below it is answered and listed in the
assumption digest. What is this skill's own is who answers a question that
clears it — and that turns on whether a person will read the proposal before
anything is built.

**Where the proposal will be read, pick and flag.** In an interactive run
without `auto-approve-plan`, answer a question that clears the bar with the
option you would recommend and carry on. Record it like a self-answer — with
the source of the step that met it, `"assumption": true`, and a rationale
ending `(picked; shown in the proposal)` — run the sync command, and fold it
into the plan the same way. The
proposal (step 8) opens with every such pick, each in the Question format with
the pick as its Recommendation, so the user confirms or changes it before
anything is built. That is what makes picking safe: a wrong pick costs one plan
edit at the proposal.

**Where nobody will read it, park.** Under `auto-approve-plan` — and headless
under `lightsout queue` — no proposal is read before the build, so a question
that clears the bar is never planned past: the run parks — see
[Parking a run](#parking-a-run).

**An answer that acts outside the plan is asked before it is acted on.** A
question whose answer changes something beyond the plan files — the work
order's mode, or a scope call that splits the ticket into several plans —
cannot be undone by editing the plan at the proposal. It is an unscheduled
checkpoint instead: ask it in the Question format before the step that depends
on it, then fold the answer in and carry on. Under `auto-approve-plan` the run
parks.

**A pick made after the proposal was approved is shown again.** With
`propose-before-draft` the proposal comes before the draft, so the design check,
the grill or the grade can still make a pick, or flag a settled decision, after
the user approved it. Before anything is built, show a short amended proposal
holding only those picks and flags, in step 8's order, and ask for approval of
them.

## Convergence invariant

**A grade below A is never a terminal success state.** Treat a grader's
`needs-a-human` or `unjudged` label as evidence to evaluate through this
skill's escalation bar, not as authority to stop the run. For every finding
below the bar, resolve it from the approved scope, recorded decisions, and
repository conventions; update the plan and decisions; then re-run the
applicable validation, deduplication, and grade checks.

**Convergence budget.** After the initial grade, perform at most **two**
repair rounds. Each round resolves every below-bar finding, records the
decisions, runs the applicable validation and deduplication checks, then grades
again — and each regrade is mostly mechanical, because the deterministic checks
re-run for free. A passed, complete grade (A) proceeds normally.

If both rounds are spent and the plan remains below A, preserve the complete
grade history and present the remaining gaps and the changes the rounds made.
Ask the human to choose exactly one: authorize one more round, explicitly accept
the current below-A plan and proceed to implementation, or change direction /
settle a genuine product-level decision. Do not auto-approve or auto-implement a below-A plan.
Only an explicit human acceptance may bypass the A-grade requirement; record it
in `decisions.json` and run the sync command before rolling onward.

The only exception is a question that genuinely clears the escalation bar:
one that cannot be resolved from the record and whose alternatives visibly
change the product. Handle it as [The escalation bar](#the-escalation-bar)
says: pick and flag where the proposal will be read, park where it will not. Do
not manufacture such an escalation because convergence is inconvenient or a
grader labeled it `needs-a-human`.

## Settled decisions

**Settled means settled — never re-answer it.** Before routing any question
through the bar, check whether the answer is already on the record. Three
records count, and all three are the user's (`<plan-folder>` is the absolute
path `plan workspace` prints in step 1):

| Where | Holds |
|---|---|
| `<plan-folder>/brainstorm-decisions.json` | what was settled with the user in a brainstorm before this session |
| `<plan-folder>/decisions.json` | what was settled earlier in this run |
| the drafted plan's `## Decision Log` | a rendering of the rows of both, composed by the engine — read a settled answer here, never write one |

**Record first, refresh, then edit the plan.** The engine composes the
`## Decision Log` from the two record files, so a row written into a plan file
by hand is overwritten the next time it runs. Every decision made after the
draft — a grill answer, a dedup resolution, a converge resolution, a veto — is
appended to `decisions.json` **first**, then the log is refreshed with:

```sh
node "<plugin-root>/dist/cli.mjs" plan sync-decisions --name <name>
```

Only then edit the plan content the answer changes. Never write a
`Decision Log` row by hand. The steps below call this **the sync command**.

**Name the phases a decision concerns.** For a phased plan, a row that
resolves a finding carries `"phases"` naming the finding's `phase` file, plus
any other phase file the answer changes. A revision row that repeats a
question names the phases its new answer concerns; the engine also covers the
phases the row it replaces named. A decision that names its phases lets the
next re-grade read those phases and the phases connected to them, not the
whole plan. Step 3 says when to leave the field out.

A settled question is **dropped**, not answered again: it adds no record
anywhere, and it never enters the bar's routing at all. The one row a settled
decision may gain is a flag, under the shaping rules'
`## Flagging a weak settled decision`.

**Re-open a settled decision only for a contradiction you can name at a
specific `file:line`.** A re-opened decision is recorded as a **new** row that
**repeats the original row's `question` text verbatim**, with a rationale naming
the `file:line` and saying which row it supersedes — the engine's renderer
marks every earlier row sharing that question as superseded by the later one,
so the corrected answer is the binding one while both rows stay in the log.
Run the sync command afterwards. Never edit `brainstorm-decisions.json`;
brainstorm owns it, and both rows belong in the log.

**A settled decision is not a self-answer.** It never enters the assumption
digest, because the user already made it.

**A settled decision you believe is weak is built as it stands, and flagged.**
With no contradiction to name, it is not re-opened: follow the shaping rules'
`## Flagging a weak settled decision`, record the flag row, and carry the
concern in the proposal (step 8). Never stop the run for it.

Two further rules are the plan skill's, in its own `## Settled decisions`
section, and apply here unchanged: the user's latest explicit instruction
outranks every record, and on a ticket holding several plans an earlier plan's
records are context rather than this plan's settled rows. Read them there.

**Headless under `lightsout queue` there is no user to ask.** A discrepancy
between the ticket text and the instruction being followed is recorded as a
decisions row naming what the ticket says and which instruction won, and nothing
is written to the ticket.

## Steps

Each `lightsout …` command this skill runs runs in the foreground to its exit
before its output is acted on. Headless under `lightsout queue`, it must also
have exited before the turn ends, because the harness kills whatever is still
running then. The one command this skill backgrounds is the interactive
`implement` hand-off at the end, which never runs under the queue.

**0. Read the config.** Read `lightsout.config.json` at the repo root and take
its `auto-plan` block. A missing file, a missing block or a missing key all
mean `false`. State the three resolved values back in one line before doing
anything else, so the user knows which checkpoints are live — for example:

```
auto-plan: propose after drafting · implement on approval · proposal required
```

**1. Name the plan and gather the source.** **Under `lightsout queue`,** `<name>`
is the plan address the task message names. The engine chose that plan and put it
on the work order's record before this session started, so no derivation runs at
all: plan exactly that folder, and never run `work-order new`, `work-order
add-plan` or `work-order mode`.

**Outside the queue,** naming follows the plan skill's step 0: `work-order new`
when no work order exists yet, then `work-order show`, then the lowest-numbered
plan still at `planning` or a plan added with `work-order add-plan`. Never invent
a folder name and never rename one — `work-order new` is the one writer of a
name, and it writes it once. One difference is this skill's: a switch to
multiple-plan mode changes whether the work order ships on its own, so it clears
the escalation bar — it is an unscheduled checkpoint, or a park under
`auto-approve-plan`.

When the request is a rough-notes file path, read it before anything else; when
it already lives under the plans directory, take `<name>` from the path segments
below that directory rather than deriving a new one.

When the work traces to a ticket, read the ticket and follow the
ticket-workflow skill at `<plugin-root>/skills/ticket-workflow/SKILL.md`:
its `## Decisions` lines are settled
rows, its `## Open questions` are this run's agenda, and its acceptance criteria
are floors, never ceilings.

Once `<name>` is settled, establish the plan's own worktree as the very first
shell command:

```sh
node "<plugin-root>/dist/cli.mjs" plan workspace --name <name>
```

It prints two lines. The one starting `plan folder:` gives the absolute path of
this plan's folder — `<plan-folder>` from here on. It lies under the primary
checkout, outside the tree, so it outlives the tree once its work ships. The
last line is the tree's absolute path, alone. Read source and run every
`lightsout plan …` call from the tree, but author, read and edit every
plan-folder file — `facts.json`, `decisions.json`, the brainstorm files, and the
plan files edited in the grill and converge — at `<plan-folder>`, never at a
path relative to the tree: a relative path read inside the tree lands in the
wrong folder. Pass any rough-notes path as an absolute one, since it lives in
the checkout you started from. A nonzero exit is the end of the run — report the
sentence it printed and stop, never carry on in the launching checkout. The
command is safe to re-run: a session already standing in the tree is answered
the same paths. A queue worktree needs no second tree: the command recognises the
queue's ticket worktree and answers that same directory, so there the step is a
no-op rather than a relocation.

Then read `<plan-folder>/brainstorm-decisions.json` when it exists — its rows
are already settled with the user. It may not be on disk yet: `plan
verify-facts` in step 2 fetches the brainstorm the ticket carries, so the folder
is read again there.

**2. Explore and verify the facts.** Read the files the request touches, follow
the integration points, and note real signatures; for a feature spanning many
packages, optionally fan out read-only Explore subagents for breadth — either
way YOU author the facts, and only from paths you confirmed by reading them.
Author `<plan-folder>/facts.json` in the **exact** shape the plan
skill documents (the engine hard-parses it). Then run:

```sh
node "<plugin-root>/dist/cli.mjs" plan verify-facts --name <name> [--notes "<path>"]
```

**That command also fetches the brainstorm the ticket carries** — both
`brainstorm-notes.md` and `brainstorm-decisions.json` — into
`<plan-folder>/`, before it reads anything. So they have now landed in the
folder even when this machine never saw them, and they must be read there
before the interview is routed. Step 3's `Settled decisions` check reads
them at that point, not before.

Pass `--notes` when the request came from a rough-notes file. **When the run
traces to a ticket instead, author the notes yourself first** — the idea in the
ticket's words, the scope call, the approach chosen and the ones rejected with a
one-line why — write them to a temporary path and pass that via `--notes`, so
the frozen `brainstorm-notes.md` carries this self-brainstorm's reasoning the way it would
carry a human brainstorm's. The snapshot is write-once; re-running verify-facts
never clobbers it. **Skip the self-authored notes entirely when `verify-facts`
fetched a `brainstorm-notes.md` from the ticket**: that file is the brainstorm's
own record, the write-once snapshot already makes it win, and authoring a second
one only invites this skill to believe its own summary is the record.

Fix any genuinely wrong path in facts.json and re-run verify-facts. While
reading, deliberately check each settled brainstorm decision against the code
and note any conflict with the exact `file:line`.

**3. Answer the interview yourself.** Work the plan skill's Elicitation agenda
— the scope check, the global-constraint collection, the harvest of the session
and of the ticket, the brainstorm hand-off — but route every item through the
escalation bar instead of asking it.

- **Harvested rows are settled.** Decisions the user already made in this
  session, in the ticket's `## Decisions`, or in a brainstorm row are recorded
  with `"assumption": false` and never enter the digest. A ticket line a
  `Revises ticket decision:` brainstorm row quotes is not harvested; that row
  binds instead, as the plan skill's harvest says.
- **Every self-answer is a row** with `"source": "Elicitation"` and
  `"assumption": true`.
- **Global constraints.** A project-wide rule the user has already stated (in
  the ticket, in the session, or in a brainstorm row) gets its own row whose
  `question` begins exactly `Global constraint:`. Do **not** invent one; when
  none was stated there are no such rows and the plan's section will read
  `None`.
- **The scope call** — one plan, one phased plan, or several independent plans
  — clears the bar whenever it would split the ticket into more than one plan,
  because that decides what gets built. A single-versus-phased call does not:
  the engine makes its own estimate at draft time.
- **There is no alignment checkpoint to earn.** This skill's licence to
  self-answer is the bar, and the user granted it by invoking the skill.
- Author `<plan-folder>/decisions.json` in the **exact** shape the
  plan skill documents: `planName`, plus a `decisions` array of
  `source` / `question` / `options` / `choice` / `rationale` / `assumption`,
  and the optional `phases` — a list of the phase-file basenames the decision
  concerns. Leave `phases` out when the decision reaches the whole plan, when
  its reach is not known, on rows written before the plan is drafted (phase
  files do not exist yet, so no row from this step carries it), and on
  `Global constraint:` rows, which always reach the whole plan. Never write an
  empty list.

**4. Propose early** (only when `propose-before-draft` is true). Show the
proposal now, before any engine agent spends, in step 8's order: the picks and
flags step 3 made first, then the design shape in plain words, the digest of
step 3's other self-answers, and the plan folder path. Run step 8's proposal
handling. On approval, continue to step 5 and show no second proposal — except
the amended one [The escalation bar](#the-escalation-bar) requires for a pick or
flag made after approval.

**5. Draft.** Run:

```sh
node "<plugin-root>/dist/cli.mjs" plan draft --name <name>
```

A draft can take many minutes. It is still run in the foreground and waited on
to its exit — never backgrounded.

Pass `--scope single|phased` only to override the engine's estimate. On a facts
error, correct facts.json, re-run verify-facts and re-draft. On remaining
structural issues on a phased plan's breakdown while no phase file exists yet,
resplit the overview's `## Phases` table and its `## Phase Declarations` to
spread the creates and the touched files across more phases — no phase may pass
the created-file ceiling or the touched-file ceiling of 70 — then re-run draft.
A phase whose whole work is renaming may instead be declared rename-only, with
the `- **Renames only:** yes` bullet.

Once phase files exist, never re-draft to change the breakdown. Edit the phase
files at `<plan-folder>` — split, merge, or move work between them — and, for
each changed phase, its `## Phases` row and `## Phase Declarations` block in the
overview, then run:

```sh
node "<plugin-root>/dist/cli.mjs" plan sync-phases --name <name>
```

It restates every phase's counts, file budget and renames-only flag from the
phase files and writes only the overview. It refuses — naming each — any phase
file, row, block or number that does not line up; fix those by hand (add the
missing row or block, renumber, rename the file) and run it again.

**6. Grill it yourself.** Run the shaping rules' `## The design check` against
the drafted plan first; an objection you accept is a question like any other
below, and one that would change a settled decision is flagged instead. Then
generate the same stream of edge-case questions the plan skill's grill does,
the one whose answer moves the plan most first. The pass interrogates the
contract — the file map, the exported signatures, the file each new file
mirrors, and the acceptance-test ledger — because that is what a plan carries
that a test cannot state for itself.

- **Drop** a question the record already answers, with no new row.
- **Route the rest through the bar.** Self-answered → append the row to
  `decisions.json` with `"source": "Grill"`, `"assumption": true` and a
  rationale ending `(self-answered)`, run the sync command, then fold the
  answer into the plan file via Edit. Above the bar → as
  [The escalation bar](#the-escalation-bar) says: a pick, a checkpoint, or a
  park.
- **Name the phases.** On a phased plan, a Grill row carries `"phases"` naming
  the phase files the answer changes, and a row that re-asks a question names
  the phases its new answer concerns.
- **Stop rule.** The plan skill's: **stop when one complete pass over every
  plan file produces no question whose answer would change the plan.** A second
  pass that only re-treads settled ground is the signal.

**7. Dedup and grade.**

```sh
node "<plugin-root>/dist/cli.mjs" plan dedup --name <name>
```

Read `<plan-folder>/dedup.json`. Route
each finding through the bar, as the plan skill's Dedup Review does. Whether to
reuse, extend or extract is ordinarily a best-practice call and so below the
bar: **apply the judge's `recommendation`**, or a better resolution when you can
name why. The rare finding that clears the bar is handled as
[The escalation bar](#the-escalation-bar) says. Append
one `decisions.json` row with `"source": "Dedup"` per resolution — on a phased
plan with `"phases"` naming the finding's `phase` file, plus any other phase
file the resolution changes — and run the sync command once, then apply each resolution to the plan file the finding's
`phase` names — `reuse` drops the Files-to-Create entry and wires the plan's
usage to the existing symbol; `extend` adds a Files-to-Modify entry for it;
`extract` adds the shared file at `suggestedLocation` plus a Files-to-Modify
entry per `migrateCallers`; `defer` leaves the entry and records the accepted
duplication in `## Prior Art`; `distinct` records the justification there. A
finding whose resolution the record already carries is applied from the record,
not re-decided. `"complete": false` means the scan was partial — resolve what is
there and re-run dedup.

```sh
node "<plugin-root>/dist/cli.mjs" plan grade --name <name>
```

Read `<plan-folder>/grade.json`. `"passed": true` **and**
`"complete": true` → go on. Otherwise take the blocking gaps (`needs-a-human`
and `unjudged`), route each through the bar, and resolve the below-bar ones by
appending a `decisions.json` row with `"source": "Converge"` — on a phased plan
with `"phases"` naming the gap's `phase` file, plus any other phase file the
answer changes — running the sync command, then editing the plan file the gap's
`phase` names — then re-grade.
**Never re-run `plan draft`**: it regenerates the plan files and would clobber
every edit folded in since. An edit that changes the phase breakdown is
followed by `plan sync-phases --name <name>`, never a re-draft.

- **A pass whose `incompleteReason` names blocking structural findings ran no
  semantic reader.** Its `gaps` list is empty because nobody looked. Fix the
  structural findings and re-grade before reading anything into it.
- `scope` says how far the pass reached. Only a `full` pass can be `passed`; a
  `focused` pass is a repair check and is always `"complete": false`. The engine
  chooses the scope and runs the full review itself once a focused pass clears,
  so a focused pass is one pass — clearing it buys no extra repair round.
- A blocking gap carrying a `findingId` is a finding the plan has seen before.
  Its record is in `<plan-folder>/grade-memory.json`, which the engine
  owns: never edit it, and never treat a finding's absence from a later pass as
  it being resolved. A record closes only when the plan states the answer and the
  engine's re-verification judge cites where.
- When a re-grade reports that a recorded passing full review still covers the
  current inputs, nothing was re-run and that grade is current. Deleting
  `grade-memory.json` forces a new baseline.
- **Convergence rule.** A below-A grade is work to do, not a proposal input.
  Apply the [convergence invariant](#convergence-invariant): resolve every
  below-bar gap, record the decision, re-run validation and deduplication when
  the edit affects them, and re-grade until the result is passed and complete
  or the two repair rounds are spent. Do not stop merely because two grades
  have similar findings, a run is taking a long time, or the grader used a
  `needs-a-human`/`unjudged` label.

**8. The proposal.** One final response, unless `auto-approve-plan` is true
and nothing cleared the bar. The proposal and its approval request are the
deliverable for that turn: do not put any part only in commentary. It carries,
in this order:

- **the picks**: every question that cleared the bar and was answered with a
  pick, each in the Question format with the pick as its Recommendation — they
  open the proposal because they are the answers most likely to be changed;
- any gap left unresolved, in the Question format;
- what the plan builds, in plain words — two or three sentences, no jargon;
- **concerns with settled decisions**: each flag raised under the shaping
  rules' `## Flagging a weak settled decision` — the decision, the concern, the
  alternative and its cost — noting that the plan builds the settled decision
  as it stands;
- **the assumption digest**: a table of every other self-answered question —
  the question, the choice, and the one-line why — in the order the rows were
  made;
- the counts the plan states (files created, files touched) and where the plan
  folder is on disk;
- what approval does next, read from the config: start the build, or stop.

Then the ask, in one line: approve, answer a pick differently, change a settled
decision a concern names, veto specific digest rows, or change direction.

- **A pick answered differently is settled by that answer.** It already carries
  its Options, so there is nothing to re-ask: append the user's choice to
  `decisions.json` with `"source": "Converge"` and `"assumption": false`,
  repeating the pick row's `question` text verbatim so the engine marks the
  pick superseded, run the sync command, fold it into the plan file via Edit,
  and re-grade.
- **A settled decision the user changes** is their latest explicit instruction:
  record it as the plan skill's `## Settled decisions` says, run the sync
  command, fold it into the plan file via Edit, and re-grade.
- **With no proposal shown** — `auto-approve-plan` true and nothing cleared the
  bar — the concerns with settled decisions still reach the user: their rows
  are in the plan's Decision Log, and the run's final report lists them in one
  line each.
- **A veto re-opens exactly that question.** Ask it live in the Question format,
  append the corrected answer to `decisions.json` with `"source": "Converge"`,
  repeating the vetoed row's `question` text verbatim, run the sync command,
  fold the answer into the plan file via Edit, re-grade, and show a short
  amended digest. Never re-draft.
- **A change of direction is a stop.** Say plainly that this is what
  the interactive `plan` skill is for, and hand the plan folder over.

**9. Publish the approved ticket-backed plan.** Once approval exists — explicit
or automatic — and before either handing off or implementing, publish when the
work traces to a ticket:

```sh
node "<plugin-root>/dist/cli.mjs" plan publish --name <name>
```

A successful publish is also what moves this plan from `planning` to `ready` on
the ticket's record.

Then write the ticket's planning status. **The command differs between the two
ways this skill runs.**

Interactive run — the planning status and the tracker status move together:

```sh
node "<plugin-root>/dist/cli.mjs" ticket-state --ref <ticket> --planning-status planning-complete --tracker-status ready
```

Headless under `lightsout queue` — the planning status alone:

```sh
node "<plugin-root>/dist/cli.mjs" ticket-state --ref <ticket> --planning-status planning-complete
```

Under the queue the ticket is **already In Progress**: the queue records that
before this worker's agent starts. Passing `--tracker-status ready` there would
move the ticket backwards out of In Progress while a live worktree still owns
its branch — and `planning-complete` at Ready to implement is one of the three
pairs the queue selects, so a later drain could pick up work already underway.
The build the queue runs after this session ends would then write In Progress a
third time. Omitting the flag writes the planning status and leaves the tracker
status alone.

With no ticket, skip both commands. A nonzero exit from either is a stop: report
the exact failure and do not hand off or implement an artifact another machine
cannot recover. Under `lightsout queue`, report that as `failed` in the worker's
final JSON so the ticket parks with the actionable error. Never treat a
passing grade or automatic approval as a substitute for these commands; the
grade proves the plan is ready, while publish makes that ready plan durable.
Writing `planning-complete` here is what the implement run finds and preserves —
step 10's run interactively, and the queue's own engine-owned build under
`lightsout queue` — so the ticket never enters In Progress still claiming
shaping is owed.

**10. Roll onward.** Under `lightsout queue` this step does nothing at all,
whatever `implement-on-approval` says: stop after step 9's publish and report
`complete`. The queue runs the implement pipeline itself, outside this session,
because a build started inside an agent session dies when that session does. On a
ticket holding several plans it builds the ready ones in numeric order after this
session ends, not this plan alone.

Otherwise, with `implement-on-approval` false, print the handoff line
and stop:

```
Next: run the `implement` skill with <plan-folder>
```

On a multiple-plan work order, add the same line the plan skill's step 8 adds: it
stays open until the user files a ship request with `lightsout work-order
request-ship`, and the ticket-workflow skill's `### Ship requests` says what it
has to name. Never file one yourself.

With it true, read `<plugin-root>/skills/implement/SKILL.md` and follow it
in full, using `<plan-folder>` as the provided plan path, just as if
the user had invoked `implement` directly. That includes launching the
implementation with `implement --detach` in the foreground, posting the
engine's output verbatim, and pointing the user to `/lightsout:status --run
<id>` for updates and `lightsout stop --run <id>` to stop it. Running the
implementation CLI without that procedure skips the hand-off to the user and is
not the handoff. The implement skill owns the launch and hand-off procedure so
both entry points stay in step.

The engine performs the In Progress write itself at the `implement` edge and
refuses to start when it fails, so this skill writes nothing further. Whether
that run then chains into ship is the `ship` block's business inside the engine,
not this skill's.

## Parking a run

When `auto-approve-plan` is true and a question clears the bar, there is no proposal
to carry it in and the skill does not guess past it. It:

- stops before the step that depends on the answer;
- when the work traces to a ticket, appends the question to that ticket's
  `## Open questions` section, creating the section when absent, following the
  ticket-workflow skill at `<plugin-root>/skills/ticket-workflow/SKILL.md`
  — written as a question, never as a
  prescription. Neither field is written: the ticket keeps
  `planning-ready-auto-plan` and its current tracker status. A parked run is
  waiting on a human, and reclassifying the ticket underneath them would hide
  that;
- when there is no ticket, states the question in the final response instead;
- reports the plan folder path, and says that the interactive `plan` skill or a re-run
  after the question is settled continues the work.

`auto-approve-plan` means *do not wait for me when nothing needs me*. It never means
*guess past what does*.

## Parking under `lightsout queue`

When this skill runs headlessly under `lightsout queue`, there is no user in
the session to park a question to, and no ticket step to write it on. The
parking above does not apply. Instead:

- stop before the step that depends on the answer;
- report `terminated:ambiguity` as the final JSON, with the question as the
  first entry of `failures`, and stop there — nothing is written to the ticket
  from inside the session.
- never end the turn while an engine command is still running; a command that
  could not be waited on to its exit is reported as a failure naming the step.

The engine relays the question to the terminal that started the queue, writes
the answer to the run's decisions file and to the ticket's `## Decisions`
section, and re-invokes with it. The worktree keeps whatever was already done,
so the re-invocation continues rather than starting over.

## What this skill never does

- It adds no engine subcommand and changes no engine plan machinery. Every
  deterministic step is the `lightsout plan …` subcommands as they already
  stand.
- It never edits the plan or brainstorm skills. Those are the manual route and
  stay exactly as they are.
- It does not lower the bar because a run is taking long.
- It does not skip Dedup or Grade to reach the proposal sooner.
