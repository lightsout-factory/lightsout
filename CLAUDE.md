# lightsout

A lights-out software factory for coding agents: humans settle every decision
in the plan, then agents implement, test, and refactor unattended while
deterministic gates — the repo's own tests, lint, types, coverage — enforce
its standards. The engine is a code spine (gates, typed contracts, resumable
manifests, supervisor) that spawns the user's own installed harness
(Claude Code, Codex, OMP, Pi) to do the work. It makes agents accountable, not smarter.

## Guidelines

For all coding changes and diagnosis, only suggest or apply best-practice solutions. Never suggest a patch or a hack — only suggest changes with the long-term health of this codebase in mind.

Prefer correctness over speed of response.

To write or review a rule in a standards library, follow `plugin/skills/standards-rule/SKILL.md`. For the built-in `lightsout` library, also read `packages/lightsout-standards/README.md`.

Keep the engine and the standards libraries separate, in both directions. Standards are generic: any team writes its own library, and the agents code against it. So nothing standard-specific is hardcoded into the engine: its code and prompts never name a rule or a pack, never depend on a convention a rule defines (a folder name, a file layout), and never state standards policy of their own. A rule, in turn, never names an engine feature. Engine code that already breaks this is a defect (LO-199), not a precedent to follow. Before proposing any engine change during standards work, say plainly that it is an engine change and wait for a yes.

## Linear Tickets and Git Branches
One ticket = one branch = one PR, and a work order holds its plans — follow the `ticket-workflow` skill, with `linear-ticket` for the Linear mechanics.

Never file a ticket unless I asked for that specific ticket in the moment, or a lightsout skill explicitly instructs it — those skills you follow. Noticing something worth a ticket is not permission to create one — say what you found and wait.
