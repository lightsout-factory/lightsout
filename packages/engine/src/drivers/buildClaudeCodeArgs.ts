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
	writableDirs?: string[];
}

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
 */
export const buildClaudeCodeArgs = ({ systemPromptPath, model, effort, permissions, allowedCommands, environment, writableDirs }: Params): string[] => {
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

	// Absent permissions leave Claude in its default mode, which confines writes
	// to the working directories exactly as `acceptEdits` does. One pair per
	// directory, ahead of every variadic flag: --add-dir is variadic too, so a
	// single flag followed by every directory would swallow the next argument.
	if (permissions === undefined || permissions === Permissions.Write) {
		for (const dir of writableDirs ?? []) {
			args.push('--add-dir', dir);
		}
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
