# Shaping rules

The rules the `brainstorm`, `plan` and `auto-plan` skills share. This file is
their one copy: each skill reads it here, at
`<plugin-root>/skills/plan/shaping-rules.md`, and restates none of it. What a
skill keeps for itself — how many questions go in one message, and who answers
a question that clears the escalation bar — stays in that skill.

The job is the best design, not only a complete one. The questions are how the
user's knowledge reaches the design; they are not the measure of the work. A
question that did not need the user spends their attention and gives them
nothing back, so fewer, better questions that reach the same design are always
the better session.

## Recommending a design

**Read before you propose.** Before offering any approach, read the code the
idea touches — the files it would change, the pattern the nearest neighbour
follows, the integration points. An approach offered before that read is a
guess about a codebase you could have looked at. Never ask what the code can
answer.

**Vet every option before it is offered.** An option earns its place only if
you would build it and defend it when asked "is this best practice?". Judge it
against how established tools solve the same problem and against this
codebase's own conventions — never against a ticket's wording, or a name or
shape that happens to be in the conversation already. A name, key or value
drafted inside an option passes the same test before it is written down.

**Offer as many options as survive, and no more.** There is no target count.
When one approach survives, present it alone, say in one line why the others
fell, and ask the user to confirm it; never add a weaker alternative to fill a
slot. When the approaches that survive differ in nothing the user would see,
the choice is below [the escalation bar](#the-escalation-bar): make it, and say
which you chose and why in one line rather than asking.

**Look it up when memory is not enough.** When an option or a recommendation
rests on facts about an outside library, tool or service — its current API, its
version, how it behaves — check those facts with a web search tool when one is
available rather than recalling them. Architecture judgment needs no lookup:
reason it through from what you know.

**Cite a precedent only when you are sure it is real.** A recommendation names
the precedent it follows ("ESLint keeps rules apart from the configs that select
them") only when you know it holds — look it up when you are not. With no
precedent you are sure of, say the why is your own reasoning; never cite one to
fill the slot. A ticket's settled decisions bind the design, but its wording is
never evidence that an option is best.

## The design check

Completeness and quality are different questions, and every other review in
these skills asks the first: what a builder would still have to guess at, which
edge cases are unhandled, whether an agent can implement the plan. The design
check asks the second, once per session, at the point each skill names.

Spawn a subagent with no memory of the conversation — the session that chose
the design is the worst judge of it. Give it the design as it now stands (the
converged design, or the drafted plan), the ticket when there is one, and the
paths of the code the design touches, and ask it to answer as a senior engineer
reviewing the approach before it is built:

- Is there a simpler design that meets the same goal?
- What would an experienced engineer in this domain object to?
- What does this design make hard to change later?
- Where does it depart from how the codebase, or established tools, already
  solve the same problem — and is the departure earned?

Weigh each objection yourself. One you judge wrong is dropped, with its one-line
reason kept in your notes. One you judge right changes the design: route the
change through [the escalation bar](#the-escalation-bar) like any other
question, and when it would change a settled decision, apply
[Flagging a weak settled decision](#flagging-a-weak-settled-decision) instead.

## The escalation bar

Put a question to the user only when **both** of these hold:

1. Two reasonable engineers, given everything already settled, would choose
   differently — or the answer is a product preference only the user holds:
   who the work serves, what they will see, what is in or out.
2. The difference is visible to the user or to the product — a name they will
   read, a behaviour they will see, a cost they will pay, or a decision they
   will live with.

Fail either one and you answer it yourself.

**A best-practice question never escalates, however hard it is.** How to
structure a file, which existing pattern to mirror, what to name a private
helper, where a test goes, which of two designs is sounder when nothing the
user sees differs, how to keep a function under the size cap — the standards,
the surrounding code and your own engineering judgment answer these, and a user
who is asked one learns nothing they did not already delegate.

**When you are unsure whether a question clears the bar, answer it yourself and
list it.** Every self-answer is recorded as an assumption and shown to the user
in the skill's digest, where it can be vetoed. A wrong self-answer costs one
edit at the digest; a needless question costs the user's attention for nothing.

**Ask the question that would change the most first.** Order what clears the
bar by how much of the design its answer moves. A question whose answer changes
one line waits behind one whose answer changes the approach.

**Who answers a question that clears the bar is each skill's rule.** `brainstorm`
and `plan` ask the user. `auto-plan` answers it and shows what it chose, or parks
the run — its own `## The escalation bar` section says which.

## Flagging a weak settled decision

Settled decisions are never re-asked, and each skill's own rules say what counts
as settled and when a contradiction in the code re-opens one. This rule is for
the other case: a settled decision you believe is not the best choice.

Raise it only when you would not build it yourself **and** can name both the
better alternative and what the settled choice concretely costs. A preference
that clears neither is not worth the user's attention. Raise each decision at
most once per session.

A flag is not a re-ask. It states the settled decision, the concern, the
alternative and the cost, and leaves the decision standing until the user
changes it:

- `brainstorm` and `plan` put it to the user in the Question format, with
  **keep the settled decision** as one option.
- `auto-plan` builds the settled decision as it stands and carries the flag in
  its proposal; its own steps say where.

Every flag is also recorded as a decision row, so it reaches the plan's Decision
Log even when nobody reads it live: the `question` begins exactly
`Concern with a settled decision:`, the `choice` is the settled decision, kept,
the `rationale` names the alternative and the cost, `assumption` is `false`, and
`source` is the one the step that raised it uses — `"Brainstorm"` throughout a
brainstorm, and in a plan `"Elicitation"`, `"Grill"` (the design check
included), `"Dedup"` or `"Converge"`.

**When the user changes the decision** in answer to a flag, record their new
answer instead of the flag row:

- **In `plan` and `auto-plan`,** as a new `decisions.json` row repeating the
  settled row's `question` text verbatim, with a rationale naming the user's
  instruction and the row it supersedes — the repeated text is what marks the
  old row superseded — then run the sync command.
- **In `brainstorm`,** where a ticket `## Decisions` line is the settled record
  and is never copied into the exit file, as a row whose `question` begins
  exactly `Revises ticket decision:` followed by that line verbatim, with the
  user's new answer as its `choice`. The ticket's line stays as it is; the
  planning skills read this row as the binding answer.

## Question format

**Pick the shape from what the answer is.** Before writing the question,
ask: does answering it mean inventing a name or a short phrase the code or
the user will see — a value, a state, a field, a flag, a message? Two or
more of them: draft the real names as a table under **Options**, one row
each, first column the name, second column a short description of what that
thing is. Exactly one: write the drafted wording out inline, in full, rather
than describing it. Any other question stays prose. The labeled parts below
apply either way — this test only decides whether the names get written down
or talked about, and the 1–3 sentence target counts sentences, not table
rows.

Every question put to the user uses this labeled four-part shape, in this
order:

**Context:** what the question is about and why it matters, in everyday
words. Write for someone who has not read the plan or the code — never
assume they know the plan's internals. State the problem the question
decides — in everyday words — before naming any options.

**Question:** the question itself, one sentence.

**Options:** the answers to choose between, each one vetted under
[Recommending a design](#recommending-a-design), one per line, each opening
with a bracketed number and its name — `(1) <name>: …` — then what it wins and
what it costs. The number is there so the user can reply with the digit alone;
the name is what makes the list readable to someone who skipped the paragraphs
above. When an option carries risk, say what goes wrong if it fails and what
catches it.

**Recommendation:** the option you recommend, named by its number, and the
one-line why — so a reply of just that number resolves it. The why follows the
precedent rule under [Recommending a design](#recommending-a-design).

**Presentation.** Each labeled part is its own short paragraph — bold label,
blank line between parts. No bullet dashes on the labels; the blank lines
are what keep the block readable.

**Extra parts are welcome when needed.** If something the user must know
fits none of the four labels (a safety note, a cost, a deadline effect),
add another bold-labeled paragraph rather than forcing it in or leaving
it out.

**Plain language, always.** No jargon. Never use an internal name — a file,
symbol, subcommand, or engine term — without saying what it means in
everyday words. If the reader would need to open a file to answer, the
question is not ready to ask.

**A label reads like a well-named variable.** Someone who skips straight to
the options knows what each one is from the label alone — nothing borrowed
from the paragraphs above it or from its place in the list. `needs-a-human`
passes; "Not true" and "the third one" do not. When the question is about
which action to take, name each option by what it does ("copy the file each
run", "keep the first copy"). When the question asks you to invent a name,
the drafted name itself is the label. An internal name never appears in a
label, even one explained earlier in the question — the label names what
the option does in everyday words (`checker-per-plan-file`, not
`fourth-lens`).

**Keep each part short.** Aim for 1–3 plain sentences per label. When a
question outgrows that, treat it as a sign it is really two questions —
split it. Brevity is for the user's reading, never a reason to leave out a
cost or a risk they need to decide.

**Durable question delivery.** A pending decision is the deliverable for that
turn. Put every complete question block in the final response that waits for
the user's answer. Never put the full block in commentary and then summarize or
repeat only its Question in the final response; commentary may report progress,
but must not contain a decision the user needs to answer.

**Never ask through an option-picker tool** — the kind that shows a list of
one-line choices to select from. Every question is written out in that final
response, in the shape above. A picker's labels cannot carry a Context, an
Options list, or a drafted table, so what it saves in typing it takes out of the
user's ability to answer.
