---
name: brainstorm
description: Shape a vague idea into a buildable direction through dialogue — checks whether it is one idea or several, offers the competing approaches worth building, with trade-offs and a recommendation, and converges on a design stated in plain words. Use when the user has a rough idea, wants to think through a feature before planning it, or asks to brainstorm. It decides its own outcome — ready to implement, or ready to auto-plan — and always writes the design write-up and the settled decisions, publishing both to the ticket.
allowed-tools: Bash, Read, Write, Grep, Glob, Task, WebSearch, WebFetch
---

# lightsout: brainstorm

**This skill is an interactive conductor, not the engine.** It holds zero
deterministic decisions — no gates, retries, caps, state, or contract parsing.
It runs a few engine subcommands, and only when the idea traces to a ticket:
`brainstorm publish`, `ticket-state`, `work-order new`, `work-order show` and
`work-order add-plan`, plus `work-order mode` once the user has agreed to it. It still
holds no deterministic decision of its own, and it never reads back what it
writes. Triggering is gentle: the
description above is the only trigger — no hook, no forced invocation. Writing
the settled-decisions file below changes nothing about this standing — the skill
never reads the file back; the engine validates it at draft time.

## Shaping rules

**Once the plugin root is resolved (below), read
`<plugin-root>/skills/plan/shaping-rules.md` before step 1, and follow it
throughout.** It is the one copy of the rules this skill shares with `plan` and
`auto-plan`: how to recommend a design, the design check, the escalation bar
that decides which questions reach the user, how to flag a settled decision you
believe is weak, and the Question format every question to the user uses.

A brainstorm has two jobs, and the bar serves both. It draws out the product
direction only the user holds — who the work serves, what they will see, what
is in or out — and those questions clear the bar. And it makes the architecture
the best one available — and those questions mostly do not: a question of which
design is sounder, when nothing the user sees differs, is yours to answer. The
user sees every such answer when the design is stated back (step 4) and in the
settled-decisions table (step 7), marked as an assumption, where either can be
changed.

What is this skill's own:

- **A question that clears the escalation bar goes to the user.**
- **One question at a time** — brainstorm conversations are exploratory, not
  batched.

## Plugin root

Resolve the plugin root once from this loaded skill's absolute path: it is two
directories above this `SKILL.md`. In Claude Code, `${CLAUDE_PLUGIN_ROOT}` may
provide the same path; do not assume that variable exists in Codex skill shell
calls. Use the resolved absolute path wherever `<plugin-root>` appears below,
and confirm `<plugin-root>/dist/cli.mjs` exists before running anything.

## Steps

**1. Understand the idea.** Let the user talk; reflect back what you heard in
plain words. Read the codebase in-context (Read/Grep/Glob) when it answers a
question — never ask what the code can answer. Before step 3, read the code the
idea touches as well: the files it would change, the pattern the nearest
neighbour follows, and the integration points, as the shaping rules'
`## Recommending a design` asks.

When the idea traces to a ticket, read the ticket first. Its `## Decisions`
lines are outcomes the user already settled — never re-ask them, and do not copy
them into this skill's exit file: the `plan` skill harvests the ticket itself,
and a copy here would put the same row in the record twice. One you believe is
weak is flagged once, under the shaping rules'
`## Flagging a weak settled decision`, never re-asked; a line the user changes
in answer is recorded the way that section says, which revises the line rather
than copying it. Its `## Open questions` are this conversation's agenda. Its acceptance criteria are floors,
never ceilings: a criterion naming one case does not decide that other cases are
out of scope. A "no" the user settles here is a decision row like any other, and
a rejected idea never becomes a new ticket.

Also read what the ticket already holds:

```sh
node "<plugin-root>/dist/cli.mjs" work-order show --name <work-order>
```

It prints the work order's mode and its plans. Where the user's latest explicit
instruction differs from the ticket text or from an earlier plan, follow the
user; say what differs when that is useful, and ask about updating the ticket per
the ticket-workflow skill's `## Keeping the body true` — never hold this
conversation up waiting for that answer.

On a work order that already holds plans, read the earlier plans' records as context
about what was built. They are not this brainstorm's settled rows. A change the
user wants to a plan that is already implemented is work for a new plan, not a
revision of that one.

**2. Scope check.** Judge out loud: is this one buildable idea, one idea too
big for a single pass, or several independent ideas? Several → say so, agree
which one to shape now, and note the rest for later.

On a work order, the same check decides **which of its plans this idea is**.
The default is the lowest-numbered plan still at `planning`, unless the user says
this is a separate plan — the rule the ticket-workflow skill's `### Adding a
plan` states, which also says what adding one refuses. A continued plan that
already holds a brainstorm meets step 7's question about an existing file.

Two cases are asked before anything is added, in the Question format:

- **Single-plan mode with plan 001 already past `planning`:** ask whether to
  switch the work order to multiple-plan mode. A no means this idea is not a plan
  on this work order, and the brainstorm says so rather than adding one anyway.

**3. Approaches.** Present the genuinely different ways to build it that
survive the shaping rules' `## Recommending a design`, in the Question format —
as many as survive, with no target count; when only one does, present it alone
and say in one line why the others fell. Give what each wins, what each costs,
and which one you recommend and why. Skip only when the user already arrived
with a chosen approach, and say so in one line.

**4. Converge.** State the design back in plain words — what gets built, what
it touches, what is explicitly out, and the architecture choices you made
yourself, each with its one-line why — and iterate until the user confirms it
matches what they meant. This is the one place the user sees the whole design
at once, so a choice of yours they would make differently surfaces here.

**5. Probe the design.** The session that had the conversation is the worst
judge of whether the design is complete, or the best one — believing it is, is
the exact failure this step exists to catch. So hand the work to a reader who
was not there.

Write the converged design out in full, plus the ticket when there is one, and
spawn a subagent with no memory of this conversation. Its brief carries two
questions: the shaping rules' `## The design check`, answered against that
design and the code it touches; and the questions a builder would still have to
guess at. It reads that statement, the ticket and the code, and nothing else of
the conversation.

Weigh each objection as the design check says, and test each returned question
against the shaping rules' `## The escalation bar`. Ask what clears the bar in
the Question format, one at a time, most consequential first; answer the rest
yourself and record each as an assumption. Fold every answer into the design,
restate what changed, then probe once more — the second round asks only the
builder's questions, since the design check runs once. **At most two rounds**,
then stop: a loop with a human in it spends their attention rather than the
machine's.

**6. Judge the outcome.** The skill decides this itself; never ask the user
which exit to take. The brainstorm holds the context needed to judge, so asking
would hand the work back for no gain.

**Ready to implement is only open to two cases:** plan 001 of a single-plan
ticket, and work that traces to no ticket. Every plan of a multiple-plan ticket
ends at **ready to auto-plan**, because a later plan is built from its own plan
deliverable rather than from the ticket body.

Where it is open, **ready to implement** requires **all five** of:

- every file that changes is named, along with what changes in each;
- nothing is left open;
- one package is touched;
- the change adds nothing a user can see — no new command, flag, config key or
  output;
- the test that proves it can be named in one sentence.

Anything else is **ready to auto-plan**. Say which outcome you chose and why, in
one line.

**7. Write, publish, label.** Both outcomes write both files. There is no exit
that writes nothing.

Every plan belongs to a work order, so a work order comes first. Never invent a
folder name and never rename one: `lightsout work-order new` is the one thing
that writes a work order's name, and it writes it once.

**With no work order yet**, create one. Give it the ticket when the idea traces
to one, and the words you would have slugged when it does not:

```sh
node "<plugin-root>/dist/cli.mjs" work-order new --ticket <ref>
node "<plugin-root>/dist/cli.mjs" work-order new --title "<a few words>"
```

Take the label it prints on its last line. Behind `--ticket` the engine reads
that ticket's title from the tracker and summarises it itself, so no name is
offered for override; behind `--title` the words are taken exactly as typed, so
offer those words to the user first.

**With a work order**, `<name>` is the plan's address — the continued plan's, or
the one this command prints on its last line:

```sh
node "<plugin-root>/dist/cli.mjs" work-order add-plan --name <work-order> --slug <slug> [--title <title>]
```

Take the printed address rather than building one, and relay any notice it prints
about a withdrawn ship request. What that command refuses, and why, is the
ticket-workflow skill's `### Adding a plan`; do not restate those rules here.

Every `.lightsout/work-orders/<work-order>/plans/<plan-id>/` path and the
`brainstorm publish --name <name>` command below then resolve unchanged.

Before writing anything, show the settled decisions back to the user as a small
table — question, choice, one-line why, and whether it is an assumption — and
get approval: these rows make the planning skills skip questions, so a row that
overstates the agreement is expensive.

Then write the notes to
`.lightsout/work-orders/<work-order>/plans/<plan-id>/brainstorm-notes.md`, plus
`.lightsout/work-orders/<work-order>/plans/<plan-id>/brainstorm-decisions.json`
in this exact shape:

```json
{
  "planName": "<name>",
  "decisions": [
    { "source": "Brainstorm", "question": "<q>", "options": "<A / B>",
      "choice": "<chosen>", "rationale": "<one line>", "assumption": false }
  ]
}
```

- `source` is exactly `"Brainstorm"` on every row — the engine rejects the
  file otherwise.
- Every project-wide rule the user stated gets its own row whose `question`
  begins exactly `Global constraint:` — that prefix is what carries it into
  the plan's constraints section.
- A choice the user never explicitly confirmed is written with
  `"assumption": true`.
- One row per decision that establishes or changes a design choice or an
  edge-case handling — not per exchange.

**If either file is already in that plan folder**, a previous brainstorm wrote
it, and what to do splits by case:

The address is not negotiable — `brainstorm publish` reads the ticket reference
off the work order's record, and a folder renamed to dodge an existing file can
never be published. Say what the existing files hold and ask before replacing
them; on a yes, overwrite in place and keep the address. Never rename. When the
work is genuinely separate, it is a separate plan, or a separate work order named
with `work-order new --title <words>`.

**When the idea traces to a ticket**, run these in order. A nonzero exit from
either is a stop: report the exact failure and do not claim the brainstorm
finished.

```sh
node "<plugin-root>/dist/cli.mjs" brainstorm publish --name <name>
```

Then, for **ready to implement**:

```sh
node "<plugin-root>/dist/cli.mjs" ticket-state --ref <ticket> --planning-status planning-complete --tracker-status ready
```

or, for **ready to auto-plan**:

```sh
node "<plugin-root>/dist/cli.mjs" ticket-state --ref <ticket> --planning-status planning-ready-auto-plan
```

Ready to auto-plan passes no `--tracker-status`: a ticket awaiting a plan is not
ready to implement, and Backlog is already queue-eligible.

**When the idea traces to no ticket**, neither command runs and the files stay
on disk. That is the ordinary case for a brainstorm that runs before its ticket
exists.

**8. Close.** With a ticket:

- **Ready to implement:** name the ticket, say it is now Ready to implement, and
  say the queue's next drain builds it from the ticket body. Print no
  `lightsout implement` command — that command takes `--plan <path>` and the
  engine refuses a folder holding neither `plan.md` nor `overview.md`, which is
  exactly what this outcome writes, so any command printed here could not run.
- **Ready to auto-plan:** print the exact next command —
  ``Next: run the `auto-plan` skill on <ticket>, plan <name>`` — naming the
  plan's address, so the next session plans that plan rather than deriving one —
  and add one line saying that a person who would rather plan it themselves sets
  `planning-needs-plan` by hand instead.

With no ticket, both outcomes point at the folder rather than at a tracker,
because nothing was published. Both lines carry the same second sentence: file
the ticket and run `brainstorm publish`, because until that happens the record
exists on one laptop. The folder keeps the label it was created with — nothing
is renamed when the ticket arrives.

- **Ready to auto-plan:** ``Next: run the `auto-plan` skill with
  .lightsout/work-orders/<work-order>/plans/<plan-id>/brainstorm-notes.md``
- **Ready to implement:** name
  `.lightsout/work-orders/<work-order>/plans/<plan-id>/` and say the two files
  plus the converged design are the whole record, so the work can be built
  straight from them. Print no command here either, for the reason above.

## Notes file content

A checklist, not a template this skill enforces:

- the idea in the user's words
- the scope call
- the chosen approach and the rejected alternatives with the one-line why
- the converged design in plain words
- any project-wide constraints the user stated (so the planning skills can carry
  them into their Global Constraints collection)
- the outcome this skill chose — ready to implement, or ready to auto-plan — and
  the one-line why
