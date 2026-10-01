import type { Effort } from '#src/contracts/Effort.ts';
import { Permissions } from '#src/contracts/Permissions.ts';
import type { AgentEnvironment } from '#src/drivers/common/types/AgentEnvironment.ts';

const claudePermissionModes: Record<Permissions, string> = {
	[Permissions.ReadOnly]: 'plan',
	[Permissions.Write]: 'acceptEdits',
	[Permissions.FullAccess]: 'bypassPermissions',
};

interface Params {
	systemPromptPath?: string;
	model?: string;
	effort?: Effort;
	permissions?: Permissions;
	allowedCommands?: string[];
	environment?: AgentEnvironment;
	foregroundCommandsOnly?: boolean;
	timeoutMs?: number;
}

/**
 * Only `env` is set, so authentication, model, effort and permissions are
 * untouched. Without a timeout there is no engine ceiling to lift the Bash
 * ceilings to, so the harness default stands.
 */
const foregroundCommandsSettings = ({ timeoutMs }: { timeoutMs?: number }) => {
	const ceiling = timeoutMs === undefined ? {} : { BASH_DEFAULT_TIMEOUT_MS: String(timeoutMs), BASH_MAX_TIMEOUT_MS: String(timeoutMs) };

	return JSON.stringify({ env: { CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: '1', ...ceiling } });
};

/**
 * `--strict-mcp-config` loads zero MCP servers only because no `--mcp-config` is
 * passed anywhere here. `--setting-sources ""` is deliberately not emitted: it
 * takes the repository's own CLAUDE.md out of the spawn, and a plan writer is
 * ordered to follow it.
 *
 * The wholesale modes are refused. `--bare` restricts auth to an API key, moving
 * the user off their subscription; `--restricted` refuses `bypassPermissions`,
 * which `full-access` maps to; `--safe-mode` disables CLAUDE.md. Each is also a
 * bundle the harness may change between versions, where per-property flags say
 * exactly what is expressed.
 *
 * A foreground-commands request becomes one `--settings` env block.
 * `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS` removes the background-shell
 * mechanism, because a print-mode session kills a background shell seconds
 * after its final turn. `BASH_DEFAULT_TIMEOUT_MS` and `BASH_MAX_TIMEOUT_MS` lift
 * the per-command ceiling to the invocation's own, because a foreground command
 * the harness kills part-way is as unfinished as a backgrounded one. The
 * variables go through `--settings` rather than the spawn's environment because
 * Claude Code writes a settings-file `env` entry over an inherited variable, and
 * `--settings` outranks user, project and local settings. They reach every
 * process the session starts, including the Claude Code writers `plan draft`
 * spawns: those are one-turn print-mode sessions with the same failure mode and
 * their own engine timeouts, so that is accepted rather than stripped.
 */
export const buildClaudeCodeArgs = ({
	systemPromptPath,
	model,
	effort,
	permissions,
	allowedCommands,
	environment,
	foregroundCommandsOnly,
	timeoutMs,
}: Params): string[] => {
	// stream-json (which requires --verbose in print mode) delivers every event
	// live for transcripts and progress. Excluding the dynamic sections keeps the
	// default system prompt byte-identical between steps, so its cached prefix holds.
	const args = ['-p', '--output-format', 'stream-json', '--verbose', '--exclude-dynamic-system-prompt-sections'];

	if (systemPromptPath) {
		// Append, never replace, to keep the harness's default agent behavior. The
		// file variant, because role + plan + standards can exceed the argv ceiling.
		args.push('--append-system-prompt-file', systemPromptPath);
	}

	if (model) {
		args.push('--model', model);
	}

	if (effort) {
		args.push('--effort', effort);
	}

	if (permissions) {
		args.push('--permission-mode', claudePermissionModes[permissions]);
	}

	if (environment?.noMcpServers) {
		args.push('--strict-mcp-config');
	}

	if (environment?.noSkillCatalog) {
		args.push('--disable-slash-commands');
	}

	if (environment?.toolAllowlist) {
		// One comma-joined argument, not one argument per name: --tools is
		// variadic, so a list spread across separate arguments would be
		// ambiguous wherever another flag follows.
		args.push('--tools', environment.tools.join(','));
	}

	if (foregroundCommandsOnly) {
		args.push('--settings', foregroundCommandsSettings({ timeoutMs }));
	}

	// The grant flag stays last: it is variadic, so a flag emitted after it
	// would have to be told apart from a grant by the harness's own parser.
	if (allowedCommands && allowedCommands.length > 0) {
		// `Bash(<prefix>:*)` is the CLI's prefix-match permission rule;
		// --allowedTools is variadic, one rule per granted prefix. Additive
		// only — user settings that already allow more stay in charge.
		args.push('--allowedTools', ...allowedCommands.map((prefix) => `Bash(${prefix}:*)`));
	}

	return args;
};
