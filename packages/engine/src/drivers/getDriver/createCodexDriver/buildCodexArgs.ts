import type { Effort } from '#src/contracts/Effort.ts';
import { Permissions } from '#src/contracts/Permissions.ts';

interface Params {
	/** Temp file codex writes its final message to (`--output-last-message`). */
	outFile: string;
	model?: string;
	effort?: Effort;
	permissions?: Permissions;
	writableDirs?: string[];
}

/**
 * There is no focused-environment mapping: `codex exec` publishes no isolation
 * flag, so a focused request runs as an ordinary session. The controls only save
 * tokens, so the spawn is still correct without them.
 */
export const buildCodexArgs = ({ outFile, model, effort, permissions, writableDirs }: Params): string[] => {
	const args = ['exec', '--skip-git-repo-check', '--color', 'never', '--output-last-message', outFile];

	if (permissions === Permissions.FullAccess) {
		// The bundled flag sets approval and sandbox together; a separate approval
		// override would re-split the axis this driver keeps off the config surface.
		args.push('--dangerously-bypass-approvals-and-sandbox');
	} else {
		const isReadOnly = permissions === Permissions.ReadOnly;

		args.push('--sandbox', isReadOnly ? 'read-only' : 'workspace-write');

		// Only the workspace-write sandbox takes extra writable roots; read-only
		// must never gain one.
		if (!isReadOnly) {
			for (const dir of writableDirs ?? []) {
				args.push('--add-dir', dir);
			}
		}

		// `codex exec` never prompts, so the policy is pinned rather than made a
		// setting. The value is TOML; spawnCollect uses no shell, so the quotes
		// reach codex literally.
		args.push('-c', 'approval_policy="never"');
	}

	if (model) {
		args.push('--model', model);
	}

	if (effort) {
		args.push('-c', `model_reasoning_effort="${effort}"`);
	}

	return args;
};
