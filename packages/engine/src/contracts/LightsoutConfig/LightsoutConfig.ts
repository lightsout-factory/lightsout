import { z } from 'zod';
import { ConfigAutoPlan } from '#src/contracts/ConfigAutoPlan.ts';
import { ConfigCommands } from '#src/contracts/ConfigCommands.ts';
import { ConfigDocs } from '#src/contracts/ConfigDocs.ts';
import { ConfigGates } from '#src/contracts/ConfigGates.ts';
import { ConfigImplement } from '#src/contracts/ConfigImplement.ts';
import { ConfigPlan } from '#src/contracts/ConfigPlan.ts';
import { ConfigPricing } from '#src/contracts/ConfigPricing.ts';
import { ConfigQueue } from '#src/contracts/ConfigQueue.ts';
import { ConfigShip } from '#src/contracts/ConfigShip.ts';
import { ConfigTicketTracker } from '#src/contracts/ConfigTicketTracker.ts';
import { ConfigWorktree } from '#src/contracts/ConfigWorktree.ts';
import { Effort } from '#src/contracts/Effort.ts';
import { GateOverrides } from '#src/contracts/GateOverrides.ts';
import { validateGateOverrideNames } from '#src/contracts/LightsoutConfig/validateGateOverrideNames.ts';
import { PackageGates } from '#src/contracts/PackageGates.ts';
import { Permissions } from '#src/contracts/Permissions.ts';
import { StandardsRuleSettings } from '#src/contracts/StandardsRuleSettings.ts';

/** One schema for every pack address, so `standards-pack` and `package-standards-packs` refuse a value with one message. */
const standardsPackAddress = z.string().refine((value) => /^[^/]+\/[^/]+$/.test(value), {
	message: 'a standards pack is named <library>/<pack> — exactly one slash, the library before it and the pack after it',
});

/** One pack, or several applied in listed order, the last listed winning where two grade one rule differently. */
const standardsPackSelection = z.union([standardsPackAddress, z.array(standardsPackAddress).min(1)]);

/**
 * The only coupling point between the engine and a consumer. Every block naming
 * an outside service is opt-in, so the engine runs with no tracker, forge
 * convention or documentation surfaces at all.
 *
 * Keys are kebab-case, the file's spelling, and the parsed value keeps it, so a
 * run manifest's config snapshot round-trips unchanged. Every block is
 * `.strict()`, so a typo never silently leaves a setting at its default.
 */
export const LightsoutConfig = z
	.object({
		/** Harness name. Defaults to 'claude-code'. */
		harness: z.string().optional(),
		/** Model override passed through to the harness. */
		model: z.string().optional(),
		/** Reasoning effort passed through to the harness. Omit to take each harness's own default. */
		effort: z.enum(Effort).optional(),
		/**
		 * Harness-neutral capability level for agent invocations. Defaults to
		 * 'write'. `read-only` is engine-selected for the supervisor and is
		 * deliberately not settable — it would make a writing role write nothing.
		 */
		permissions: z.enum([Permissions.Write, Permissions.FullAccess]).optional(),
		/** Per-command harness selection. See `ConfigCommands`. */
		commands: ConfigCommands.optional(),
		/** Verification commands — the mechanical gates. See `ConfigGates`. */
		gates: ConfigGates,
		/**
		 * Invocation ceilings, in minutes, for the agents a run spawns and for the
		 * gate commands it runs. A hit ceiling is a recorded step failure the run
		 * can resume from — never a crash.
		 */
		timeouts: z
			.object({
				/** Working roles (executor, test writers, refactorer, fixes). Default 60. */
				'agent-minutes': z.number().positive().optional(),
				/** The read-only supervisor. Default 15. */
				'supervisor-minutes': z.number().positive().optional(),
				/** One gate command — the repo's own check, test, coverage, build or end-to-end run. Default 15. */
				'gate-minutes': z.number().positive().optional(),
			})
			.strict()
			.optional(),
		/**
		 * Command prefixes working agents are granted (prefix match, arguments
		 * allowed) — for plan deliverables only a command can produce, e.g. a
		 * migration generator that needs the live dev database. Injected into the
		 * executor's task as an explicit grant list and passed to the harness as
		 * allowed tools. Verification commands never belong here: the engine runs
		 * all gates itself, and agents are told grants are not for verifying.
		 */
		'agent-commands': z.array(z.string()).optional(),
		/**
		 * Path prefixes of generated files, e.g. a Prisma client output dir. They
		 * are excluded from changed-file attribution, because the source that
		 * generates them is the change.
		 *
		 * Also where a repo names build output the walk cannot guess:
		 * `listSourceFiles` skips only `dist`, `build`, `coverage` and `out`, and
		 * only outside a `src` folder.
		 *
		 * A phase of a sequence leaves generated changes on disk for the next
		 * phase, and the sequence discards them once it passes, so a repo whose
		 * checks read these paths should configure `gates.generate`.
		 */
		generated: z.array(z.string()).optional(),
		/**
		 * Path prefixes of third-party code the repo vendors in, e.g. a shadcn/ui
		 * component folder. Excluded from the source walk like `generated`, but a
		 * vendored file is attributed when it changes: it has no source in the
		 * repo, so an edit inside it is the change.
		 *
		 * The exclusion stops only the engine's own checks; a repo's coverage
		 * threshold must exclude the path itself.
		 */
		vendored: z.array(z.string()).optional(),
		/**
		 * Default `coverage/coverage-summary.json`: repo-relative in
		 * single-package repos, package-relative in monorepo mode. The JSON file,
		 * not a printed table, is the tool-agnostic contract.
		 */
		'coverage-summary-path': z.string().optional(),
		/**
		 * How many source files one plan or phase may create or modify before the
		 * feature executor refuses it. Default 50 (`defaultExecutorFileLimit`).
		 * One key for every reader, because a plan graded against a softer number
		 * and then refused at implement time costs a whole run.
		 */
		'executor-file-limit': z.number().positive().optional(),
		/** Directory holding workspace packages, for monorepo scoped gates. Default 'packages'. */
		'packages-dir': z.string().optional(),
		/** Monorepo scoped gate templates. See `PackageGates`. */
		'package-gates': PackageGates.optional(),
		/**
		 * Opt-in per-checkpoint gate schedules, keyed by the four verification
		 * checkpoints. A listed checkpoint runs exactly the gates its entry names,
		 * in that order; an unlisted one keeps the engine's default. See
		 * `GateOverrides`.
		 */
		'gate-overrides': GateOverrides.optional(),
		/**
		 * The standards for the repo root and every package
		 * `package-standards-packs` does not name: one pack address,
		 * `<library>/<pack>`, or a list of them. Standards are opt-in, so unset
		 * and `false` both mean no standards for the root and every unnamed package.
		 */
		'standards-pack': z.union([standardsPackSelection, z.literal(false)]).optional(),
		/**
		 * Standards of its own for each package that differs from `standards-pack`.
		 * Keys are package folder names under `packages-dir`, as `--packages` uses
		 * them; values are one pack address (`<library>/<pack>`) or a list of them.
		 * `false` is not accepted here: only `standards-pack` takes it. Parsing
		 * never reads the disk, so a key naming no workspace package is refused when
		 * the groups resolve, by `resolveStandardsGroups`.
		 */
		'package-standards-packs': z.record(z.string().min(1), standardsPackSelection).optional(),
		/**
		 * Standards libraries registered beside the built-in one. Each key is a
		 * library name; each value is a repo-relative folder (starting `./` or
		 * `../`, or an absolute path) or an npm package name resolved from the
		 * repo's `node_modules`. `lightsout` is built in and reserved. Whether a
		 * key is allowed and matches its library's manifest is checked when the
		 * libraries load, by `resolveStandardsLibraries`.
		 */
		'standards-libraries': z.record(z.string(), z.string()).optional(),
		/** Per-rule severity/options settings, the final layer over the selected pack. See `StandardsRuleSettings`. */
		'standards-rule-settings': StandardsRuleSettings.optional(),
		/** Opt-in ship settings — branch ticket pattern, pull request body template, merge method. See `ConfigShip`. */
		ship: ConfigShip.optional(),
		/** Opt-in auto-plan settings — which of `/auto-plan`'s checkpoints this repo keeps. See `ConfigAutoPlan`. */
		'auto-plan': ConfigAutoPlan.optional(),
		/** Opt-in plan settings — whether plans are written as contracts with an acceptance-test ledger, and the counts above which a plan file is heavy. See `ConfigPlan`. */
		plan: ConfigPlan.optional(),
		/** Opt-in implementation settings — the cleanup round budget the refactor step spends. See `ConfigImplement`. */
		implement: ConfigImplement.optional(),
		/** Opt-in published rates, keyed by model identifier, in dollars per million tokens. Read only by `lightsout report`, to print a separate estimated-cost column; nothing computed from it is ever stored. See `ConfigPricing`. */
		pricing: ConfigPricing.optional(),
		/** Opt-in shared workspace preparation — the one command run inside a fresh worktree, by the queue and by an isolated implementation run alike. See `ConfigWorktree`. */
		worktree: ConfigWorktree.optional(),
		/** Opt-in tracker identity — provider-specific address and credential environment variables. See `ConfigTicketTracker`. */
		'ticket-tracker': ConfigTicketTracker.optional(),
		/** Opt-in queue settings — route labels, parallelism, eligible statuses and the queue's own timeouts. See `ConfigQueue`. */
		queue: ConfigQueue.optional(),
		/** Opt-in documentation surfaces — each a repo-relative path and what that document covers. See `ConfigDocs`. */
		docs: ConfigDocs.optional(),
	})
	.strict()
	// The one check no block can make on its own: an override may name a gate
	// configured under `gates`, under `package-gates`, or nowhere at all, and
	// this is the only schema that sees all three at once.
	.superRefine((config, ctx) => {
		validateGateOverrideNames({ overrides: config['gate-overrides'], gates: config.gates, packageGates: config['package-gates'], ctx });
	});

export type LightsoutConfig = z.infer<typeof LightsoutConfig>;
