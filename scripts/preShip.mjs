import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkShipped } from './checkShipped.mjs';
import { invokedDirectly } from './invokedDirectly.mjs';
import { changedSince } from './shipRelease/changedSince.mjs';
import { isNewer } from './shipRelease/isNewer.mjs';
import { repoRoot } from './shipRelease/repoRoot.mjs';
import { resolveShipBaseCommit } from './shipRelease/resolveShipBaseCommit.mjs';
import { runGit } from './shipRelease/runGit.mjs';
import { shippedDirectories } from './shipRelease/shippedDirectories.mjs';

const bumpPatch = ({ version }) => {
	const segments = version.split('.').map((segment) => Number.parseInt(segment, 10) || 0);

	while (segments.length < 3) {
		segments.push(0);
	}

	segments[segments.length - 1] += 1;

	return segments.join('.');
};

/** Rewritten in place so the manifest keeps its exact formatting. */
const writeVersion = ({ manifestPath, from, to }) => {
	const absolute = join(repoRoot, manifestPath);
	const manifest = readFileSync(absolute, 'utf8');

	writeFileSync(absolute, manifest.replace(`"version": "${from}"`, `"version": "${to}"`), 'utf8');
};

/**
 * The repository's `ship.pre-ship` command, so an unattended ship meets the
 * same bar as `pnpm bundle` plus a manual bump.
 *
 * It rebuilds first because the rebuild is itself a change the version check
 * must see. The patch moves from the BASE version, so serial queue merges each
 * land one step above whatever main holds at their turn. Nothing is committed:
 * the engine commits only once the gates pass.
 *
 * The base is `LIGHTSOUT_SHIP_BASE_COMMIT` when the engine pinned one, never
 * the fork point; run by hand, the `origin/main` merge base applies.
 */
export const preShip = async () => {
	execFileSync('pnpm', ['bundle'], { cwd: repoRoot, stdio: 'inherit' });

	const { baseCommit, pinned, problem } = resolveShipBaseCommit();

	// An unresolvable pin fails the hook rather than quietly falling back: the
	// engine only pins a commit it has fetched and merged, so a pin git cannot
	// read means the tree is not what this script was told it is.
	if (problem !== undefined) {
		throw new Error(`pre-ship: ${problem}`);
	}

	if (baseCommit === undefined) {
		console.log('pre-ship: no origin/main to compare against — bundled, versions untouched');

		return;
	}

	for (const { dir, primaryManifestPath, manifestPaths } of shippedDirectories) {
		if (!changedSince({ baseCommit, path: dir })) {
			continue;
		}

		const baseManifest = runGit({ args: ['show', `${baseCommit}:${primaryManifestPath}`] });

		if (baseManifest === undefined) {
			continue;
		}

		const headVersion = JSON.parse(readFileSync(join(repoRoot, primaryManifestPath), 'utf8')).version;
		const baseVersion = JSON.parse(baseManifest).version;
		const targetVersion = isNewer({ head: headVersion, base: baseVersion }) ? headVersion : bumpPatch({ version: baseVersion });

		for (const manifestPath of manifestPaths) {
			const currentVersion = JSON.parse(readFileSync(join(repoRoot, manifestPath), 'utf8')).version;

			if (currentVersion !== targetVersion) {
				writeVersion({ manifestPath, from: currentVersion, to: targetVersion });
			}
		}

		console.log(`pre-ship: ${dir}/ host manifests ${baseVersion} -> ${targetVersion}`);
	}

	if (pinned !== true) {
		return;
	}

	// Verified against the same pinned commit the versions were measured from,
	// not a fork point that has since moved.
	const { problems } = await checkShipped({ baseCommit });

	if (problems.length > 0) {
		throw new Error(`pre-ship: the prepared release is not shippable\n  ${problems.join('\n  ')}`);
	}
};

if (invokedDirectly({ moduleUrl: import.meta.url })) {
	await preShip();
}
