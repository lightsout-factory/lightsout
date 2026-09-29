import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderWorkflowSpec } from '../packages/engine/src/commands/index.ts';
import { invokedDirectly } from './invokedDirectly.mjs';

/**
 * Writes the `assets/*-workflow.json` specs from the command catalog, so the
 * README infographic and the command's own page cannot disagree; `--check`
 * fails when a committed file differs. Never hand-edit the output. Run
 * `pnpm build:workflow-specs`.
 *
 * They stay on disk because the flow-graphic skill's `build_graphic.py` takes a
 * file.
 *
 * The `commands` barrel is imported rather than the package, whose index graph
 * reaches `.md` prompt modules plain Node cannot load; `commands/` imports no
 * markdown, so it works under Node's unflagged type stripping.
 */
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const graphicCommands = ['plan', 'implement', 'refactor'];

const buildSpecJson = ({ id }) => `${JSON.stringify(renderWorkflowSpec({ id }), undefined, 2)}\n`;

const specPath = ({ id }) => join('assets', `${id}-workflow.json`);

/**
 * Exit codes are set rather than forced with `process.exit`: stdout is a pipe
 * for every caller that matters, and exiting right after a log discards it.
 */
const main = () => {
	const checking = process.argv.includes('--check');
	const stale = [];

	try {
		for (const id of graphicCommands) {
			const path = specPath({ id });
			const json = buildSpecJson({ id });

			if (!checking) {
				writeFileSync(join(repoRoot, path), json);
				console.log(`wrote ${path}`);
			} else if (readFileSync(join(repoRoot, path), 'utf8') !== json) {
				stale.push(path);
			}
		}
	} catch (error) {
		console.error('');
		console.error(`  ${error instanceof Error ? error.message : String(error)}`);
		console.error('');
		process.exitCode = 1;

		return;
	}

	if (stale.length > 0) {
		console.error('');
		console.error(`  ${stale.join(', ')} no longer matches the command catalog.`);
		console.error('  These are what the README infographics are rendered from.');
		console.error('');
		console.error('    pnpm build:workflow-specs && git add assets/');
		console.error('');
		process.exitCode = 1;

		return;
	}

	if (checking) {
		console.log('assets/*-workflow.json match the command catalog');
	}
};

if (invokedDirectly({ moduleUrl: import.meta.url })) {
	main();
}
