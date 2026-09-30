import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getStandardsPackBundle } from '../packages/engine/src/views/getStandardsPackBundle.ts';
import { invokedDirectly } from './invokedDirectly.mjs';

/**
 * Writes `assets/default-pack.json`, the authored built-in library with its
 * fixtures and every pack it ships; `--check` fails when the committed file
 * differs. Never hand-edit the output. Run `pnpm build:default-pack`.
 *
 * The web app needs it because the shipped copy in `plugin/standards/` has its
 * fixtures stripped, and a rule page has to show the code a rule argues about.
 *
 * `rootPath` is rewritten to the repo-relative library path: the file is
 * compared byte for byte, so it may carry nothing about the machine that
 * wrote it.
 *
 * The module file is imported rather than the package, whose index graph
 * reaches `.md` prompt modules plain Node cannot load.
 */
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const outputPath = join(repoRoot, 'assets', 'default-pack.json');

export const buildDefaultPackView = async () => {
	const bundle = await getStandardsPackBundle({ cwd: repoRoot });

	if (bundle.built) {
		throw new Error(
			`the built-in library ${bundle.name} resolved to the built copy at ${bundle.rootPath} — this script exists to capture the AUTHORED library, which still has its fixtures`,
		);
	}

	const authoredPackPath = 'packages/standards-typescript';

	return `${JSON.stringify({ ...bundle, rootPath: authoredPackPath }, undefined, 2)}\n`;
};

/**
 * Exit codes are set rather than forced with `process.exit`: stdout is a pipe
 * for every caller that matters, and exiting right after a log discards it.
 */
const main = async () => {
	const checking = process.argv.includes('--check');

	try {
		const json = await buildDefaultPackView();

		if (!checking) {
			writeFileSync(outputPath, json);
			console.log(`wrote assets/default-pack.json — ${(json.length / 1024).toFixed(0)} KB`);

			return;
		}

		const onDisk = readFileSync(outputPath, 'utf8');

		if (onDisk === json) {
			console.log('assets/default-pack.json matches the built-in library and its packs in packages/standards-typescript/');

			return;
		}

		console.error('');
		console.error('  assets/default-pack.json no longer matches the built-in library and its packs in packages/standards-typescript/.');
		console.error('  It is what the site and every viewer off this monorepo show for the built-in library and its packs.');
		console.error('');
		console.error('    pnpm build:default-pack && git add assets/default-pack.json');
		console.error('');
		process.exitCode = 1;
	} catch (error) {
		console.error('');
		console.error(`  ${error instanceof Error ? error.message : String(error)}`);
		console.error('');
		process.exitCode = 1;
	}
};

if (invokedDirectly({ moduleUrl: import.meta.url })) {
	await main();
}
