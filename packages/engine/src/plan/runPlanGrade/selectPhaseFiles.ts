import { basename } from 'node:path';
import type { DeliverableFile } from '#src/plan/common/types/DeliverableFile.ts';

interface Params {
	files: DeliverableFile[];
	/** What a human passed to `--phase`; absent selects every file. */
	phases?: string[];
}

const phaseIndexOf = ({ file }: { file: DeliverableFile }) => Number(/^phase(\d+)/.exec(basename(file.path))?.[1] ?? Number.NaN);

/**
 * A bare integer matches the phase index numerically, so `1` never also selects
 * `phase10-…`. Extensionless stems are not accepted: the basename is what every
 * finding already prints.
 *
 * A value matching no file or several is a hard failure: a typo must never
 * quietly grade nothing and report it clean.
 */
export const selectPhaseFiles = ({ files, phases }: Params): { selected: DeliverableFile[] } | { error: string } => {
	if (phases === undefined) {
		return { selected: files };
	}

	const listing = `available: ${files.map((file) => basename(file.path)).join(', ')}`;

	if (phases.length === 0) {
		return { error: `--phase named no phase file — ${listing}` };
	}

	const wanted = new Set<string>();

	for (const value of phases) {
		const matches = /^\d+$/.test(value)
			? files.filter((file) => phaseIndexOf({ file }) === Number(value))
			: files.filter((file) => basename(file.path) === value);

		if (matches.length !== 1) {
			return { error: `--phase ${value} matches ${matches.length} plan file(s) — ${listing}` };
		}

		wanted.add(matches[0].path);
	}

	return { selected: files.filter((file) => wanted.has(file.path)) };
};
