import { excludedSourcePaths } from '#src/common/sourceFiles/excludedSourcePaths.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { resolveStandardsGroups } from '#src/standards/resolveStandardsGroups.ts';
import { applyStandardsBaseline } from '#src/standardsCheck/applyStandardsBaseline.ts';
import { buildDominantPathNote } from '#src/standardsCheck/buildDominantPathNote.ts';
import { runPackageChecks } from '#src/standardsCheck/runPackageChecks.ts';
import { writeStandardsSnapshot } from '#src/standardsCheck/writeStandardsSnapshot.ts';

interface Params {
	cwd: string;
	config: LightsoutConfig | undefined;
	/** Repo-relative subpath to check (default: the whole repo). */
	path?: string;
	/** Include baselined findings instead of only what's new since the baseline. */
	all?: boolean;
	/** Write/refresh lightsout.standards-baseline.json — the explicit act of accepting the current findings as existing debt. */
	writeBaseline?: boolean;
	/** Skip writing .lightsout/standards-check.json — for in-pipeline runs that must not clobber the user's standalone report. */
	persist?: boolean;
	onProgress?: (message: string) => void;
}

/**
 * Detection is code — agents are never asked to "go find problems". Baselining
 * is explicit, never a side effect of a check run. The config is passed in
 * rather than read, because the tree under `cwd` may hold a config edited after
 * the run started.
 *
 * @throws {Error} When the standards pack cannot be loaded, or a check misbehaves — a repo that asked for standards and did not get them must not run.
 */
export const runStandardsCheck = async ({
	cwd,
	config,
	path,
	all = false,
	writeBaseline = false,
	persist = true,
	onProgress,
}: Params): Promise<{ findings: StandardsFinding[]; notes: string[] }> => {
	const groups = await resolveStandardsGroups({ cwd, config });
	const checked = await runPackageChecks({
		cwd,
		groups,
		packagesDir: config?.['packages-dir'],
		path,
		exclude: excludedSourcePaths({ config }),
		onProgress,
	});
	const findings = checked.findings;
	const notes = [...checked.notes];
	const dominantNote = buildDominantPathNote({ findings });

	if (dominantNote !== undefined) {
		notes.push(dominantNote);
	}

	const baseline = await applyStandardsBaseline({ cwd, path, findings, all, writeBaseline });

	notes.push(...baseline.notes);

	if (persist) {
		await writeStandardsSnapshot({ cwd, snapshot: { at: new Date().toISOString(), path: path ?? '.', findings, notes } });
	}

	return { findings: baseline.reported, notes };
};
