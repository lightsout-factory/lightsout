import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSprawlLanes } from './buildSprawlLanes.mjs';
import { invokedDirectly } from './invokedDirectly.mjs';
import { readSprawlCaps } from './readSprawlCaps.mjs';
import { readSprawlCommits } from './readSprawlCommits.mjs';
import { readSprawlTrees } from './readSprawlTrees.mjs';
import { runScript } from './runScript.mjs';

/**
 * Writes `assets/sprawl-dataset.json` for the site's hero animation. Every
 * number is measured from real history, never invented: the animation is a
 * claim about this repository. Never hand-edit the output. Run
 * `pnpm build:sprawl`.
 *
 * `.lightsout/` is gitignored, so the refactor markers are a LOCAL-ONLY input:
 * build and commit from the machine that carries the run history. A clean
 * checkout produces a marker-less dataset and says so.
 *
 * Deterministic, with no clock read — `headSha` is the stamp — so
 * `git diff --exit-code` after a re-run is a usable check.
 */
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const maxFrames = 400;

/** Every passed refactor run's `updatedAt` — the commits where a move was allowed to happen. */
const readRefactorMarkers = ({ log }) => {
	const runsDir = join(repoRoot, '.lightsout', 'refactor', 'runs');

	if (!existsSync(runsDir)) {
		log('no .lightsout/refactor/runs/ here — no refactor markers, so the animation is a plain growth curve');

		return [];
	}

	const markers = [];

	for (const entry of readdirSync(runsDir)) {
		const path = join(runsDir, entry, 'manifest.json');

		try {
			const manifest = JSON.parse(readFileSync(path, 'utf8'));

			if (manifest.pipeline === 'refactor' && manifest.status === 'passed' && typeof manifest.updatedAt === 'string') {
				markers.push(manifest.updatedAt);
			}
		} catch (error) {
			log(`skipping ${entry}/manifest.json — ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	return markers.sort();
};

/** A marker after every frame marks the LAST one, so the newest refactor is never lost. */
const markFrames = ({ commits, markers }) => {
	const times = commits.map((commit) => Date.parse(commit.at));
	const marked = new Set();

	for (const marker of markers) {
		const at = Date.parse(marker);
		const index = times.findIndex((time) => time >= at);

		marked.add(index === -1 ? commits.length - 1 : index);
	}

	return marked;
};

const buildDelta = ({ previous, current }) => {
	const files = [...current.files]
		.filter(([path, lines]) => previous.files.get(path) !== lines)
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([path, lines]) => ({ path, lines }));
	const folders = [...current.folders]
		.filter(([path, entries]) => previous.folders.get(path) !== entries)
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([path, entries]) => ({ path, entries }));

	return {
		files,
		folders,
		removedFiles: [...previous.files.keys()].filter((path) => !current.files.has(path)).sort(),
		removedFolders: [...previous.folders.keys()].filter((path) => !current.folders.has(path)).sort(),
		overCap: current.overCap,
	};
};

export const buildSprawlDataset = ({ log = console.log } = {}) => {
	const caps = readSprawlCaps({ repoRoot });
	const allCommits = readSprawlCommits({ repoRoot });
	const droppedCommits = Math.max(0, allCommits.length - maxFrames);
	const commits = allCommits.slice(droppedCommits);

	if (commits.length === 0) {
		throw new Error('no commit under packages/ has ever touched a .ts or .tsx file — there is no history to animate');
	}

	if (droppedCommits > 0) {
		log(`${droppedCommits} commit(s) dropped from the front — the animation carries the most recent ${maxFrames}`);
	}

	log(`reading ${commits.length} commit(s) of packages/`);

	const trees = readSprawlTrees({ repoRoot, commits });
	const marked = markFrames({ commits, markers: readRefactorMarkers({ log }) });
	const { withStates, withoutStates } = buildSprawlLanes({ trees, caps });
	const empty = { files: new Map(), folders: new Map(), overCap: 0 };

	const frames = commits.map((commit, index) => ({
		sha: commit.sha,
		at: commit.at,
		subject: commit.subject,
		isRefactorMarker: marked.has(index),
		with: buildDelta({ previous: index === 0 ? empty : withStates[index - 1], current: withStates[index] }),
		without: buildDelta({ previous: index === 0 ? empty : withoutStates[index - 1], current: withoutStates[index] }),
	}));

	const dataset = { headSha: frames[frames.length - 1].sha, caps, droppedCommits, frames };
	const outputPath = join(repoRoot, 'assets', 'sprawl-dataset.json');
	const json = `${JSON.stringify(dataset, undefined, 2)}\n`;

	writeFileSync(outputPath, json);
	log(`wrote assets/sprawl-dataset.json — ${frames.length} frames, ${marked.size} refactor marker(s), ${(json.length / 1024).toFixed(0)} KB`);

	return dataset;
};

if (invokedDirectly({ moduleUrl: import.meta.url })) {
	runScript({ run: buildSprawlDataset });
}
