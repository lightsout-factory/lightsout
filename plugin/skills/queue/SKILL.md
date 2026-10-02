---
name: queue
description: Start the lightsout queue — drain the tracker of automatable tickets in parallel worktrees, shipping a PR per ticket. Use when the user asks to start the queue, drain the tickets, run the ticket queue, or work the backlog lights-out. Requires `queue` and `ticket-tracker` blocks in lightsout.config.json and the configured tracker credentials in the environment.
allowed-tools: Bash, Read, Write, Glob
---

# lightsout: queue

**This skill is the ignition, not the engine.** It contains no queue logic —
no ticket selection, no worktrees, no shipping. All of that lives in the
engine, where it is deterministic code. Do not add workflow steps to this file.

## Steps

1. Resolve the plugin root from this loaded skill's absolute path: it is two
   directories above this `SKILL.md`. In Claude Code,
   `${CLAUDE_PLUGIN_ROOT}` may provide the same path; do not assume that
   variable exists in Codex skill shell calls. Use the resolved absolute path
   wherever `<plugin-root>` appears below. Confirm
   `<plugin-root>/dist/cli.mjs` exists; otherwise stop and tell the user to
   reinstall the plugin or run `pnpm bundle` in the lightsout repo.
2. Read the top-level `ticket-tracker` block — connection keys never live in
   `queue`. Confirm the environment variable named by
   `ticket-tracker.api-key-env` holds a value. For Jira, also confirm the
   variable named by `ticket-tracker.api-user-email-env` holds the account
   email. If a required variable is empty, stop and say which variable to set
   — the detached launch relays the engine's refusal at once, so checking the
   variable first only saves a wasted launch.
3. Launch the queue detached, **in the foreground**, from the project
   directory, with **both streams captured together**:

   ```sh
   node "<plugin-root>/dist/cli.mjs" queue --detach 2>&1
   ```

   `--detach` implies the file relay, so questions come through the mailbox
   rather than a terminal; add `--file-relay <dir>` only when the user named a
   mailbox directory. The command returns as soon as the queue has started,
   and the queue goes on in a process of its own. Worktree setup and tracker
   writes can come before the queue has started and outlast a harness's
   default command timeout, so run the command with the longest timeout the
   harness allows (Claude Code: `timeout 600000`). The engine prints
   `starting run <full id> — engine output: <launch log path>` at once, before
   it waits.

   Post everything the command printed into the conversation **verbatim**.
   Then:

   - **Nonzero exit — the queue refused to start.** Its output is the refusal:
     post it and stop, with no sentence of your own around it.
   - **The harness cut the call off before it returned.** Post what it printed
     and tell the user that `/lightsout:status --run <id>`, with the id from
     the `starting run` line, shows whether the queue started. Start no
     watcher: the engine pid and the mailbox are printed only once the queue
     has started.
   - **Zero exit — the queue has started.** Keep the three values the engine
     printed: the queue run id (`run <id> has started`), the engine pid
     (`engine pid: <pid>`) and the mailbox directory (`relay mailbox: <dir>`).
     Tell the user:
     - the queue has started and runs outside this session, so they can keep
       working;
     - questions will come to them here;
     - `/lightsout:status queue` (`lightsout status --queue`) shows the board
       whenever they ask;
     - `lightsout stop --run <id>` stops the queue.

     Also create an empty **relayed list** — a file that holds the name of
     each question file already posted, one name per line. Keep it outside the
     mailbox folder, which the engine owns and empties:

     ```sh
     mktemp
     ```
4. Watch the mailbox the engine printed with a **watcher of its own**: a
   background Bash command that polls every 15 seconds and exits as soon as
   one of three things holds:
   - the mailbox holds a `*.question.json` file whose name is not in the
     relayed list;
   - the queue's engine pid — the one `queue --detach` printed — is no longer
     running;
   - the watcher has run for 60 minutes, which keeps it under the harness's
     limit on a background command's life.

   For example, with the kept values put in place of the placeholders:

   ```sh
   deadline=$(( $(date +%s) + 3600 ))
   while kill -0 <queue-pid> 2>/dev/null && [ "$(date +%s)" -lt "$deadline" ]; do
     new=""
     for file in "<mailbox>"/*.question.json; do
       [ -e "$file" ] && ! grep -qxF "$(basename "$file")" "<relayed-list>" && new="$file"
     done
     [ -n "$new" ] && break
     sleep 15
   done
   ```

   Because the watcher runs in the background, the session stays free for the
   user between events; the watcher exiting is what wakes the session. (A
   harness with a dedicated wait-on-condition tool may use it in place of the
   shell loop — same cadence, same three wake conditions.)

   In a harness that cannot run a background command, start no watcher.
   Instead tell the user that questions wait in `<mailbox>` until the
   configured `question-timeout` and then park their ticket, and that asking
   you to check for questions runs one pass of the question check in the
   foreground: any question file not in the relayed list is relayed exactly as
   on a wake.
5. When the watcher wakes the session, check which condition holds:
   - **A question file not yet relayed exists:** read it — it holds `ticket`,
     `title`, `question` and `askedAt` — and put the complete ticket context
     and question in the response, never only in commentary. Add its file
     name to the relayed list, re-start the watcher (step 4) at once, and give
     the session back to the user. Do not wait for an answer: the other
     workers keep running.
   - **The queue's engine pid has ended:** go to step 7.
   - **Neither holds — the watcher reached its 60 minutes:** re-start the
     watcher (step 4) silently and post nothing.

   When the user answers, write the answer beside the question as a sibling
   file: same stem, `.answer.json` instead of `.question.json`, holding
   `{"answer": "<what the user said>"}`. The engine picks it up within two
   seconds, deletes both files, and the worker continues. Drop that question's
   file name from the relayed list, then re-start the watcher (step 4).
6. A question the user does not answer parks its ticket once the config's
   `question-timeout` elapses (default one hour). Say so if they ask; a later
   drain picks parked work back up.
7. When the watcher wakes because the queue's engine pid has ended, stop the
   watcher. Then run, in the foreground, with both streams captured together
   and the kept queue run id:

   ```sh
   node "<plugin-root>/dist/cli.mjs" status --queue --run <id> 2>&1
   ```

   Post its output verbatim. It is the board and drain report the queue saved
   when it finished: the finished board — headed `Queue finished` — then one
   line per ticket — shipped, parked with the reason and its worktree path,
   left open with what it is waiting for, or left behind with why. Post
   nothing further.

The bare `node "<absolute path to cli.mjs>" queue` command still exists for
anyone who would rather hold their own terminal, where questions are asked on
stdin instead.

## What to tell the user if they ask

- **Which tickets it takes:** tickets in the configured tracker scope — a
  Linear team or Jira project — whose planning-status label and tracker status
  form one of three pairs:
    - `planning-ready-auto-plan` in Backlog → the auto-plan worker plans the
      ticket first, then builds the plan it wrote. The engine picks which plan
      the session writes — the work order's lowest-numbered plan still waiting to
      be planned, or a new plan 001 for a work order that holds none yet — and
      names it in the session's task message. A ticket whose plans are all past that stage
      has nothing for the session to do and is reported open.
    - `planning-complete` in Ready to implement → the plan worker builds the
      plan already published to the ticket, fetching it when the worktree does
      not have it. On a ticket holding several plans it builds the ones ready to
      implement one at a time in numeric order on the work order's branch, committing
      each before the next starts, and stops at a lower plan still being planned,
      being implemented, or failed. When no plan is attached it builds from **the
      ticket body** instead, because `planning-complete` promises finished
      shaping, not a plan folder — a route left open for plan 001 of a
      single-plan work order, and for a single-plan work order holding no plan
      at all. That second build is recorded on the work order record, and the
      ticket ships once it passed. Two cases reach the route: a
      brainstorm that finished all shaping without writing a plan, and the
      brainstorm's ready-to-implement outcome, which writes `planning-complete`
      and Ready to implement itself. In both
      cases the worker reads the ticket body — not the brainstorm files the
      ticket carries, which are the durable record a person reads and the input
      planning fetches. When the queue creates this ticket's work order record,
      it creates it in single-plan mode whatever
      `plan.default-work-order-mode` says.
    - `planning-not-needed` in Ready to implement → the direct worker builds
      straight from the ticket body. On a single-plan work order record that
      holds no plan, the build is recorded on the record, and the ticket ships
      once that build passed. When the queue creates this ticket's work order
      record, it creates it in single-plan mode whatever
      `plan.default-work-order-mode` says.

  The last two are different workers on purpose: a `planning-complete` ticket
  has a graded plan attached, and building it from the ticket body instead
  would throw that plan away. Every other combination is left alone, and the
  planning-status label is how a human opts a ticket in. A ticket with a
  blocking ticket that is not finished — done or canceled — is not picked up;
  it is left behind naming the blocker, and the same run takes it as soon as
  the blocker ships.
- **Two planning-status labels is a skip:** a ticket carrying more than one is
  skipped with a sentence naming every planning-status label it carries.
  Exactly one is the model's rule, so two is a human error the queue will not
  resolve by guessing.
- **A missing label refuses the run at startup:** before any ticket is picked
  up, the queue checks that every configured planning-status label exists in
  the tracker, and refuses naming the missing one. It refuses the same way when
  `queue.ready-status` is not among `queue.eligible-statuses`, because the two
  build pairs could then never match and the drain would report an empty
  backlog instead of a broken config.
- **Already-merged work is reconciled, not rebuilt:** before a worktree is
  created, the queue asks the forge whether the work order's branch already has a
  merged pull request. A confirmed merge moves the ticket to Done and skips the
  worker. A parked worktree for that branch is removed when its tree is clean,
  and kept with a progress line when it is dirty.
- **Handing a later plan to the queue:** the ticket-workflow skill's
  `## Planning status` paragraph says which statuses the queue reads and what a
  human sets to hand it a later plan — including removing their own worktree for
  the work order's branch first, once its work is committed. A ticket whose worktree
  another run owns is parked, naming that owner.
- **How it runs them:** before any worktree is built, the drain settles names
  once for the whole wave — each ticket keeps the work order that already
  carries its reference, and a ticket with none gets one written exactly the way
  `lightsout work-order new --ticket` writes it. A ticket whose work order could
  not be created is left behind naming the failure, and the scan carries on.
  Each ticket then gets its own fresh git worktree, the config's `setup`
  command, and a harness run; finished branches ship as PRs.
  A ticket holding several plans is the exception: it is left **open** when its
  ship request is not satisfied — no parked label, no tracker status change — and
  every later drain looks at it again, building whichever plans have since become
  ready to implement and shipping it once it is eligible. The ticket-workflow
  skill's `### Ship requests` says how a human makes an open ticket ship.
  Up to `max-parallel` tickets run at once. The queue works in waves —
  everything unblocked runs and ships, then it re-reads the tracker and takes
  whatever the finished work just unblocked, stopping when a re-read finds
  nothing new.
- **The board on request:** `/lightsout:status queue` (`lightsout status
  --queue`) shows the queue's board whenever the user asks. First comes a board
  with seven columns — Parked, Blocked, Build Queue, Building, Ship Queue,
  Shipping Now and Shipped — where each ticket's ID sits in the one column it
  is in now, so tickets move across the columns from one board to the next.
  Under the table is a list with one line per ticket: its title, and its reason
  when it has one. Below that is a detail block for each active ticket: one
  that is building, shipping, or waiting for an answer. A detail block is
  exactly what `lightsout status` prints for that ticket's run, planning or
  ship in its worktree. A run's block lists every step the run will take, with
  the steps it has not reached shown as pending.
- **It runs detached from this session:** the queue runs in a process of its
  own, so it outlives this session. `lightsout stop --run <queue run id>` stops
  it; stopping a worker's own run is refused, with a message naming the queue
  run to stop instead.
- **Exit codes:** these are the queue's own exit code, which
  `status --queue --run <id>` shows once a detached queue has ended. 0 —
  everything eligible shipped. 2 — work remains that a
  re-run picks up (parked or left-behind tickets); a ticket left open is not
  that, because it waits on a human decision rather than on a re-run, so it never
  makes the queue exit 2. 1 — the queue refused to start; the message says why.
- **Answers are never lost:** an answer written to the mailbox is recorded in
  the queue run's decisions file and onto the ticket before the worker acts
  on it — the same guarantee, whichever channel carried it.
- **The parked label:** when the config sets `parked-label`, a parked ticket
  carries that label in the tracker and loses it when the ticket resumes or
  ships.
- **Tracker writes gate the work:** before a worker touches source, the queue
  records the ticket's planning status and moves it to In Progress. A failed
  write parks that one ticket and leaves every other worker running. After a
  merge is confirmed the ticket moves to Done; a failed Done write leaves the
  ship recorded as successful and reports a separate reconciliation failure in
  the drain report, because a tracker failure cannot undo a merge.
