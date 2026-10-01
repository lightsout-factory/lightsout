---
name: implement
description: Run the lightsout deterministic implementation pipeline on a plan file. Use when the user asks to implement a plan via lightsout.
allowed-tools: Bash, Read
---

# lightsout: implement

**This skill is the ignition, not the engine.** It contains no pipeline
logic — no gates, no retries, no state. All of that lives in the engine, where
it is deterministic code. Do not add workflow steps to this file.

## Steps

1. Resolve the plugin root from this loaded skill's absolute path: it is two
   directories above this `SKILL.md`. In Claude Code,
   `${CLAUDE_PLUGIN_ROOT}` may provide the same path; do not assume that
   variable exists in Codex skill shell calls. Use the resolved absolute path
   wherever `<plugin-root>` appears below. Confirm
   `<plugin-root>/dist/cli.mjs` exists; otherwise stop and tell the user to
   reinstall the plugin or run `pnpm bundle` in the lightsout repo.
2. Launch the run on the plan path the user provided, **in the foreground**,
   from the project directory, with **both streams captured together**:

   ```sh
   node "<plugin-root>/dist/cli.mjs" implement --detach --plan "<plan-path>" 2>&1
   ```

   For a resume request, launch `resume --detach --run <id>` the same way:

   ```sh
   node "<plugin-root>/dist/cli.mjs" resume --detach --run <id> 2>&1
   ```

   Pass through what the user gave you, nothing more:
   - a plan **folder** → hand it straight through as `--plan "<folder>"`; the
     engine branches on what the folder holds (an `overview.md` runs every
     phase in order, otherwise the folder's `plan.md` runs on its own). A plan
     of a work order is handed over by its own folder path — the one ending in
     the plan's id — never by the work order's folder above it
   - a starting phase the user asked for → `--start-phase <n>`
   - a high-level/overview plan for a single-phase run → `--overview "<path>"`
   - an explicit package scope → `--packages a,b`
   - a request to build in the checkout the user is standing in →
     `--no-worktree`; a request to build in an isolated worktree →
     `--worktree`. Neither is the default to add: the engine already
     isolates unless the repository's config says otherwise.

   The command returns as soon as the run has started, and the run goes on in
   a process of its own, so nothing is backgrounded and nothing is watched.
   Worktree setup and tracker writes come before the run has started and can
   outlast a harness's default command timeout, so run the command with the
   longest timeout the harness allows (Claude Code: `timeout 600000`). The
   engine prints `starting run <full id> — engine output: <launch log path>`
   at once, before it waits.

3. Post everything the command printed into the conversation **verbatim**.
   Then:

   - **Zero exit — the run has started.** Tell the user:
     - the run id the engine printed;
     - that the run goes on outside this session;
     - that `/lightsout:status` shows it while it is the only run going,
       including its final report once it has ended, and that
       `/lightsout:status --run <id>` always shows it;
     - that `lightsout stop --run <id>` stops it.

     `resume --detach --run <id>` continues a run that parked or was stopped;
     the same run id also resumes a multi-phase run, picking up at the phase
     that stopped.
   - **Nonzero exit — the command refused before any run started.** Its output
     is the refusal: post it verbatim and stop, with no sentence of your own
     around it, no retry and no workaround.
   - **The harness cut the call off before it returned.** Post what it printed
     and tell the user that `/lightsout:status --run <id>`, with the id from
     the `starting run` line, shows whether the run started.

## What the engine does to the ticket

Stated so nobody adds a step for it here — the engine already does it:

- Before the pipeline starts, `lightsout implement` records the ticket's
  planning status and moves the ticket to In Progress. `lightsout
  implement-direct` does the same, resolving the ticket from `--ref` or from
  the branch. The run refuses to start when either write fails, because
  required state must be recorded before source work begins.
- The planning status it records: `planning-complete` and
  `planning-not-needed` are preserved as they stand. Anything else —
  `planning-ready-auto-plan`, either `planning-needs-*` value, no label at all,
  or more than one — is written as `planning-complete`.
- When the plan carries an acceptance-test ledger, the engine writes those
  tests first. Every later change to a test file is reviewed against the plan
  before the gates run, so a test the plan's own changes make stale can be
  corrected, while a named acceptance test cannot be weakened or dropped. The
  run is not done until every named test has executed and passed in the gate
  run. Nothing in this skill triggers that; the plan's own ledger is what turns
  the step on.
- When the plan or phase only renames, it lists its renames in a `## Renames`
  section. Such a phase is built without test writing, without the cleanup pass
  and without the reviewing agent. Instead, before the gates run, the engine
  checks in code that every changed file differs from the phase's starting
  commit only by the declared renames, and refuses the checkpoint otherwise.
  Every gate still runs, coverage included. Nothing in this skill turns this
  on; the plan's own `## Renames` section does.
- Before any source work, the engine resolves the workspace itself: it picks
  the branch, creates the worktree, copies the plan or ticket inputs into it,
  and runs `worktree.setup`. Nothing in this skill creates, chooses or cleans
  up a worktree.
- For a work order's plan, the engine checks that work order's record before
  the run. It refuses an excluded plan, a plan other than 001 of a single-plan
  work order, a plan behind a lower plan that is not implemented, and a plan already
  implemented — one sentence naming the plan in the way and the command that
  resolves it. Relay that sentence verbatim and stop; never work around it. The
  rules behind those refusals are the ticket-workflow skill's
  `### Implementation order and exclusions`.
- The engine records that plan's progress around the run: being implemented when
  it starts, implemented when it passes, failed when it fails or escalates. A
  paused run leaves it being implemented, and `resume` on a failed or paused run
  is the repair path.
- After a passed run, a multiple-plan ticket chains into ship only when this run
  satisfies its ship request; otherwise the engine prints the one sentence saying
  what the ticket is still waiting for. See the ticket-workflow skill's
  `### Ship requests`.
- Nothing in this skill performs those writes. Do not add a step for them.
