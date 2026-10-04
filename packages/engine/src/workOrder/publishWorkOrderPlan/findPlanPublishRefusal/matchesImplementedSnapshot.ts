import { readFile } from 'node:fs/promises';
import { brainstormNotesFileName } from '#src/common/constants/brainstormNotesFileName.ts';
import { sha256 } from '#src/common/sha256.ts';
import { durablePlanFiles } from '#src/plan/publish/durablePlanFiles.ts';

interface Params {
	cwd: string;
	/** `<ticket-branch>/<plan-id>`. */
	address: string;
	/** The plan's durable files as the passed implementation run left them. */
	snapshot: { name: string; sha256: string }[];
}

/**
 * Checks both directions: a snapshot file gone or edited, and a new file the
 * snapshot never named. `brainstorm-notes.md` is skipped because the brainstorm
 * generation owns it, whether or not a snapshot listed it.
 */
export const matchesImplementedSnapshot = async ({ cwd, address, snapshot }: Params): Promise<boolean> => {
	const durable = await durablePlanFiles({ cwd, name: address });
	const named = new Set(snapshot.map(({ name }) => name));
	const attachable = durable.files.filter(({ name }) => name !== brainstormNotesFileName);
	let matches = durable.error === undefined && attachable.every(({ name }) => named.has(name));

	for (const entry of snapshot) {
		const file = matches ? durable.files.find(({ name }) => name === entry.name) : undefined;
		const content = file === undefined ? undefined : await readFile(file.path).catch(() => undefined);

		matches = matches && content !== undefined && sha256({ content }) === entry.sha256;
	}

	return matches;
};
