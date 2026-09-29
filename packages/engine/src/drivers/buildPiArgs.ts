import type { Effort } from '#src/contracts/Effort.ts';
import { Permissions } from '#src/contracts/Permissions.ts';

export type PiVariant = 'pi' | 'omp';

/**
 * Enabling exactly these tools disables `bash`, `edit` and `write` outright. The
 * names differ: omp calls pi's `find` `glob` and adds `lsp`.
 */
const readOnlyTools: Record<PiVariant, string> = {
	pi: 'read,grep,find,ls',
	omp: 'read,grep,glob,lsp',
};

interface Params {
	variant: PiVariant;
	systemPromptPath?: string;
	model?: string;
	effort?: Effort;
	permissions?: Permissions;
}

/**
 * There is no granted-commands mapping. Bare pi has no permission system, and an
 * omp `--config` overlay replaces `bash.patterns` wholesale, so a user's own deny
 * rules would vanish for the spawn. The grant rides the invocation prompt instead.
 * There is no focused-environment mapping either, and no wholesale minimal mode,
 * for the same reason: it could quietly close what a user's own settings allow.
 */
export const buildPiArgs = ({ variant, systemPromptPath, model, effort, permissions }: Params): string[] => {
	const args = ['-p', '--mode', 'json', '--no-session'];

	if (systemPromptPath) {
		// A path to an existing file makes the harness append its contents, because
		// role + plan + standards can exceed the argv ceiling.
		args.push('--append-system-prompt', systemPromptPath);
	}

	if (model) {
		args.push('--model', model);
	}

	if (effort) {
		// The values only one harness honors (`off`, `minimal`, `auto`) are
		// deliberately not offered in the config.
		args.push('--thinking', effort);
	}

	if (permissions === Permissions.ReadOnly) {
		args.push('--tools', readOnlyTools[variant]);
	}

	// Bare pi has no permission system, so its capability intent rides the
	// invocation prompt alone. omp's `write` tier leaves exec-tier calls rejected,
	// since a print run has no UI to answer a prompt. The mode is passed even
	// though omp defaults to yolo, so a user's settings cannot change its meaning.
	if (variant === 'omp' && (permissions === Permissions.Write || permissions === Permissions.FullAccess)) {
		args.push('--approval-mode', permissions === Permissions.Write ? 'write' : 'yolo');
	}

	return args;
};
