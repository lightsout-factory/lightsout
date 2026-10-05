import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderConfigKeyReference } from '../packages/engine/src/views/renderConfigKeyReference.ts';
import { invokedDirectly } from './invokedDirectly.mjs';
import { runScript } from './runScript.mjs';

/**
 * Writes the top-level key table of `docs/configuration.md` from the engine's
 * `configKeyDescriptions`; `--check` fails when the committed table differs.
 * Never hand-edit the generated region. Run `pnpm build:config-reference`.
 *
 * The region is bounded by HTML comments so the prose around it stays
 * hand-written: the site renders markdown without rehype-raw, so they are
 * invisible, and a comment survives every markdown tool a heading would not.
 *
 * The renderer's own module is imported rather than the views barrel, whose
 * graph reaches `.md` prompt modules plain Node cannot load.
 */
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const documentPath = 'docs/configuration.md';

const openMarker = '<!-- generated:config-key-reference -->';
const closeMarker = '<!-- /generated:config-key-reference -->';

const countMarker = ({ text, marker }) => text.split(marker).length - 1;

/**
 * @throws {Error} When a marker is missing, repeated, or out of order — appending
 * anyway would silently double the reference.
 */
export const buildConfigKeyReference = ({ text }) => {
	for (const marker of [openMarker, closeMarker]) {
		const count = countMarker({ text, marker });

		if (count !== 1) {
			throw new Error(`${documentPath} holds ${count} copies of ${marker} — it must hold exactly one`);
		}
	}

	const openIndex = text.indexOf(openMarker);
	const closeIndex = text.indexOf(closeMarker);

	if (closeIndex < openIndex) {
		throw new Error(`${documentPath} holds ${closeMarker} before ${openMarker} — the region is inside out`);
	}

	const before = text.slice(0, openIndex);
	const after = text.slice(closeIndex + closeMarker.length);

	return `${before}${openMarker}\n\n${renderConfigKeyReference()}\n\n${closeMarker}${after}`;
};

/**
 * Exit codes are set rather than forced with `process.exit`: stdout is a pipe
 * for every caller that matters, and exiting right after a log discards it.
 */
const main = () => {
	const checking = process.argv.includes('--check');

	const onDisk = readFileSync(join(repoRoot, documentPath), 'utf8');
	const text = buildConfigKeyReference({ text: onDisk });

	if (!checking) {
		writeFileSync(join(repoRoot, documentPath), text);
		console.log(`wrote ${documentPath}`);

		return;
	}

	if (onDisk === text) {
		console.log(`${documentPath} matches configKeyDescriptions`);

		return;
	}

	console.error('');
	console.error(`  ${documentPath}'s key reference no longer matches configKeyDescriptions.`);
	console.error('  It is the table every reader of the configuration page meets first.');
	console.error('');
	console.error(`    pnpm build:config-reference && git add ${documentPath}`);
	console.error('');
	process.exitCode = 1;
};

if (invokedDirectly({ moduleUrl: import.meta.url })) {
	runScript({ run: main });
}
