import { touchedFileCeiling } from '#src/common/constants/touchedFileCeiling.ts';

/**
 * Transcribed from `LightsoutConfig`'s doc comments rather than read from them:
 * TypeScript doc comments are erased before anything runs.
 *
 * The `timeouts.` entries are the block's leaves rather than shape keys: the
 * block's defaults are per leaf, so each leaf needs its own row and sentence.
 *
 * `docs/configuration.md`'s key reference is rendered from this, so a sentence
 * edited here fails `pnpm check` until `pnpm build:config-reference` has been
 * run.
 */
export const configKeyDescriptions: Record<string, string> = {
	harness: "Harness name. Supported values are 'claude-code', 'codex', 'omp' (Oh My Pi) and 'pi' (bare upstream pi). Defaults to 'claude-code'.",
	model: 'Model override passed through to the selected harness.',
	effort: "Reasoning effort passed through to the harness — one of `low`, `medium`, `high`, `xhigh` or `max`. Omit to take each harness's own default.",
	permissions:
		"Capability level for agent invocations: `write` lets agents edit files and run commands inside the workspace, and `full-access` bypasses the harness's sandbox entirely. Defaults to `write`.",
	commands:
		'Per-command `harness`, `model` and `effort` for `plan` (draft, dedup and grade), `implement`, `refactor`, `test-coverage-to-threshold` and `improve`; a command not listed uses the global keys. `resume` keeps the run manifest’s recorded harness, and takes model and effort from the configuration the run recorded when it started, never from the file as it reads now. See Command settings.',
	gates: 'Verification commands — the mechanical gates. Full shell commands, run by the engine itself; agents never run them.',
	timeouts: 'Agent invocation ceilings, in minutes. A hit ceiling is a recorded step failure the run can resume from — never a crash.',
	'timeouts.agent-minutes':
		'Ceiling for the working roles — executor, test writers, refactorer, fixes. Defaults to 60. Reaching it stops the harness together with every process it started — a terminate signal first, then a kill if that is ignored.',
	'timeouts.supervisor-minutes': 'Ceiling for the read-only supervisor, which reads and rules rather than editing. Defaults to 15.',
	'timeouts.gate-minutes':
		"Ceiling for one gate command — the repo's own check, test, coverage, build or end-to-end run. A gate that runs past it is stopped and re-run once; a gate that runs past it again stops the run as a timeout, which names the gate and the ceiling and is reported apart from a gate that failed. Such a gate is never handed to a fix agent and spends no fix attempt. Defaults to 15.",
	'agent-commands':
		'Command prefixes working agents are granted (prefix match, arguments allowed) — for plan deliverables only a command can produce, such as a migration generator. Verification commands never belong here: the engine runs all gates itself. The one verification command an agent is handed is the engine’s own self-check, granted per spawn to the roles that write code rather than configured here.',
	generated:
		'Path prefixes of generated or derived files: the source walk skips them, and changed-file attribution and a run’s own commit leave them out, because the source that generates them is the change. In a phased plan each phase leaves them on disk so the next phase starts from current build output, and the sequence discards them once it passes, so set `gates.generate` when your checks read them. See How verification works.',
	vendored:
		'Path prefixes of third-party code the repo vendors in rather than writes, such as a shadcn/ui component folder. Excluded from the source walk exactly as `generated` is, so the standards never judge it, no test is written for it and no refactor pass touches it — with one difference: a vendored file IS attributed when it changes, because no source in the repo produced it. Excluding it from a coverage threshold is your test runner’s job, not the engine’s.',
	'source-files':
		'Globs, from the repo root, of every code file lightsout reads — your tests included, since `test-files` says which of them are tests. A glob starting with `!` excludes. Inside a git repository the candidates are the files git lists, so whatever `.gitignore` already excludes, such as dependencies and build output, is never read. The standards checks, the test writer, coverage and a plan’s file counts all read this list. Defaults to the JS/TS files, `["**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}", "!**/node_modules/**", "!**/*.d.ts"]`; set it for another language or to narrow it.',
	'test-files':
		'Globs, from the repo root, of every test-side file: the tests, and the mocks, fixtures, helpers, snapshots and runner configuration that serve them — usually what your test runner’s own config already lists. The test writer, the coverage gate, the standards checks and the test-change reviewer all read this list to tell tests from source. Defaults to the names the common JS/TS runners use, `["**/*.test.*", "**/*.spec.*", "**/test/**", "**/tests/**", "**/__tests__/**", "**/__mocks__/**", "**/e2e/**"]`; set it when your runner is configured otherwise.',
	'coverage-summary-path':
		'Path to the JSON coverage summary the coverage tooling writes — the `json-summary` reporter’s `coverage-summary.json`, which `lightsout test-coverage-to-threshold` reads for per-file percentages. Defaults to `coverage/coverage-summary.json`, repo-relative in single-package repos and package-relative in monorepo mode. The file is the tool-agnostic contract, so a printed coverage table changing format never breaks a run.',
	'executor-file-limit': `How many source files one plan or phase may create or modify before the feature executor refuses it, defaulting to 50; a plan’s own \`## File Budget\` section replaces it for that plan. Neither can lift a plan or phase past the fixed touched-file ceiling of ${touchedFileCeiling} source files, from which only a rename-only or move-folders-and-files plan or phase is exempt. See Plan settings.`,
	'packages-dir':
		'The directory whose direct child folders holding a `package.json` are the workspace packages; package gates, per-package standards and pack excludes all read it. Defaults to `packages`.',
	'package-gates':
		'Monorepo scoped gate templates — the per-package commands `{package}` is substituted into. Each template runs once per affected package, so a gate runs only for the packages a change touched.',
	'gate-overrides':
		'Per-checkpoint gate schedules, keyed by `clean-slate`, `verify-implement`, `verify-tests` and `verify-refactor`: a listed checkpoint runs exactly the gates its list names, in that order, and `"off"` runs none there. A checkpoint not listed keeps the default order. See Gate overrides.',
	'standards-pack':
		'The standards for the repo root and every package `package-standards-packs` does not name: one pack address, written `<library>/<pack>`, or a list of them applied in order, the last listed winning where two grade one rule differently. Standards are opt-in: unset and `false` both mean no standards for the root and every package the map does not name. A pack that declares `applies-when` reaches only the packages whose own `package.json` declares one of the dependencies it names.',
	'package-standards-packs':
		'Standards of its own for each package that differs from `standards-pack`. Each key is a package folder name under `packages-dir`, as `--packages` uses it, and each value is a pack address, `<library>/<pack>`, or a list of them. A package the map does not name uses `standards-pack`, and has no standards when that is unset. `false` is accepted only by `standards-pack`, never here. A key naming no workspace package is an error.',
	'standards-libraries':
		'Standards libraries the repo registers beside the built-in one, each a folder of topics, rules and pack files. Each key is a library name and each value is either a folder — a value starting with `./` or `../`, or an absolute path, read against the repo root — or an npm package name, looked up in the repo’s `node_modules`. A library’s manifest `name` must equal its key, and `lightsout` is built in and reserved. Versions are fixed the way the rest of the repo’s are: by git for a folder, by the lockfile for a package, and by the plugin version for the built-in library.',
	'standards-rule-settings':
		'Per-rule severity, options and `exclude` globs, applied over the selected pack as the last layer and keyed by full rule name (`<library>/<rule>`), or by short rule id where only one rule in the pack has it. `off` stops a rule running but keeps its prose for agents, and `blocking` or `advisory` turns on a rule the pack ships off. See Standards check rules.',
	ship: 'Opt-in `lightsout ship` settings: the branch ticket pattern whose `ticket` capture group becomes the result’s ticket reference, the pull request body template, the merge method, whether a passed implement run chains into ship, an optional pre-ship command that prepares the release candidate before it is verified, and the explicit exception for a repository that intentionally has no CI.',
	'ticket-tracker':
		'Opt-in tracker identity: which provider the engine talks to and that provider’s address and credential environment variables — a Linear team and API key, or a Jira Cloud site, project, API token and account email. Every command that reads or writes a ticket resolves it from here, so tracker identity is spelled once rather than once per command.',
	worktree:
		'Opt-in shared workspace preparation. `worktree.setup` is the one command run inside a fresh worktree before any agent, such as `pnpm install` — the queue runs it in each ticket worktree it cuts, and an isolated implementation run runs it in the worktree it cuts for itself. An absent block means nothing runs. The block is strict, so a misspelled key fails parsing rather than silently leaving the command unset.',
	queue:
		'Opt-in queue settings: which ticket label names each planning status, what this tracker calls each status the engine writes, which statuses count as available work, how many tickets run at once, and the per-ticket worker and question timeouts. Tracker identity lives in `ticket-tracker`, so this block holds queue behaviour only.',
	'auto-plan':
		'Opt-in auto-plan settings: whether the proposal comes before drafting, whether an approved proposal starts the build, and whether the proposal is skipped when nothing clears the escalation bar. Every key is off by default, so an absent block is the most supervised behaviour.',
	plan: 'Opt-in planning settings: `plan.contract`, which writes plans as contracts with an acceptance-test ledger, and its weight thresholds; `plan.worktree`; and `plan.default-work-order-mode`, the mode a new work order (the folder holding one ticket’s plans) is created in. See Plan settings.',
	implement:
		'Opt-in implementation settings: `implement.worktree`, whether a run builds in its own git worktree (default true), and `implement.refactor.max-rounds`, the most cleanup rounds one run may spend (default 2). See Implement settings.',
	pricing:
		'Optional published rates, keyed by the model identifier a harness was invoked with, each entry giving `input`, `output`, `cache-read` and `cache-write` as US dollars per million tokens — the unit vendors publish, so a rate is copied rather than converted. It is optional and has no default. It is read only by `lightsout report`, where it buys one separate, clearly labelled estimated-cost column; nothing computed from it is ever stored, so the activity record stays a statement of what a harness itself reported. Each entry is strict, so a misspelled rate name fails parsing rather than silently leaving that token count unpriced while the column still prints a total.',
	docs: 'Opt-in documentation surfaces: each entry a repo-relative path and a one-line `covers` saying what that document is responsible for. Declaring the block turns on the plan-time documentation check — the plan writer is briefed on the surfaces, every implementable plan file must carry a `## Documentation` statement, and `plan grade` runs one whole-plan checker that verifies it. A repository that declares no block sees none of it: no section, no prompt text, no checker spawn.',
};
