import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathExists } from '#src/common/pathExists.ts';
import type { DeliverableFile } from '#src/plan/common/types/DeliverableFile.ts';
import { planWorkspaceDir } from '#src/plan/planWorkspaceDir.ts';

interface Params {
	cwd: string;
	/** Kebab plan name — the folder the plan's own files live in. */
	name: string;
}

interface ResolvedDeliverable {
	overviewPath?: string;
	overviewText?: string;
	/** The judged/graded files: the single plan, or every phase (overview excluded). */
	files: DeliverableFile[];
	/** Set when no plan file exists at either the single-file or the phased path. */
	error?: string;
}

/**
 * Files are matched by name, not by extension, because the folder also holds
 * the plan's working files (`brainstorm-notes.md`, the JSON records).
 *
 * Disk-only by design: a tracker fetch here would make every read-only
 * detection pass reach the network unannounced. `implement` owns the restore.
 */
export const resolvePlanDeliverable = async ({ cwd, name }: Params): Promise<ResolvedDeliverable> => {
	const dir = await planWorkspaceDir({ cwd, name });
	const singlePath = join(dir, 'plan.md');

	let overviewPath: string | undefined;
	let overviewText: string | undefined;
	const files: DeliverableFile[] = [];

	if (await pathExists({ path: singlePath })) {
		files.push({ path: singlePath, text: await readFile(singlePath, 'utf8') });
	} else {
		const dirEntries: string[] = await readdir(dir).catch(() => []);
		const entries = dirEntries.filter((entry) => entry === 'overview.md' || /^phase\d+.*\.md$/.test(entry)).sort();

		for (const entry of entries) {
			const path = join(dir, entry);
			const text = await readFile(path, 'utf8');

			if (entry === 'overview.md') {
				overviewPath = path;
				overviewText = text;
			} else {
				files.push({ path, text });
			}
		}
	}

	if (files.length === 0) {
		return {
			files,
			error: `no plan found for '${name}' — expected ${singlePath} or ${dir}/phase<N>-<slug>.md. This pass reads the disk only and asked no tracker; \`lightsout implement\` fetches a plan published to its ticket, or run \`lightsout plan publish --name ${name}\` from the machine that has it.`,
		};
	}

	return { overviewPath, overviewText, files };
};
