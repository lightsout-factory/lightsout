import type { Effort } from '#src/contracts/Effort.ts';
import { Permissions } from '#src/contracts/Permissions.ts';
import { PiVariant } from '#src/drivers/getDriver/createPiDriver/common/constants/PiVariant.ts';

/**
 * Enabling exactly these tools disables `bash`, `edit` and `write` outright. The
 * names differ: omp calls pi's `find` `glob` and adds `lsp`.
 */
const readOnlyTools: Record<PiVariant, string> = {
	[PiVariant.Pi]: 'read,grep,find,ls',
	[PiVariant.Omp]: 'read,grep,glob,lsp',
};

interface Params {
	variant: PiVariant;
	systemPromptPath?: string;
	model?: string;
	effort?: Effort;
	permissions?: Permissions;
	writableDirs?: string[];
}

/**
 * There is no granted-commands mapping. Bare pi has no permission system, and an
 * omp `--config` overlay replaces `bash.patterns` wholesale, so a user's own deny
 * rules would vanish for the spawn. The grant rides the invocation prompt instead.
 * There is no focused-environment mapping either, and no wholesale minimal mode,
 * for the same reason: it could quietly close what a user's own settings allow.
 * Writable directories are granted to omp alone: bare pi needs no grant.
 */
export const buildPiArgs = ({ variant, systemPromptPath, model, effort, permissions, writableDirs }: Params): string[] => {
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
	if (variant === PiVariant.Omp && (permissions === Permissions.Write || permissions === Permissions.FullAccess)) {
		args.push('--approval-mode', permissions === Permissions.Write ? 'write' : 'yolo');
	}

	// Only omp's `write` tier confines writes to the working directory; bare pi
	// has no permission system to grant a directory past, and yolo needs none.
	if (variant === PiVariant.Omp && permissions === Permissions.Write) {
		args.push(...(writableDirs ?? []).map((dir) => `--add-dir=${dir}`));
	}

	return args;
};
