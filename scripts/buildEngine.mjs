import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { invokedDirectly } from './invokedDirectly.mjs';

/**
 * `plugin/dist/cli.mjs` is committed: marketplace installs copy only the plugin
 * directory, and there is no install hook that could build it later.
 *
 * The esbuild options live here, not in package.json, so `checkShipped.mjs`
 * builds through the same definition of what ships. `--out <file>` lets that
 * check rebuild without overwriting the file it is asking about.
 */
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const enginePackage = join(repoRoot, 'packages', 'engine');

export const buildEngine = async ({ out }) =>
	build({
		entryPoints: [join(enginePackage, 'src', 'main.ts')],
		// Pinned, because esbuild writes each module's path into the output
		// relative to this directory; defaulting to process.cwd() would make the
		// bytes depend on where the command was run from.
		absWorkingDir: enginePackage,
		bundle: true,
		platform: 'node',
		format: 'esm',
		loader: { '.md': 'text' },
		// The bundle is ESM, but some dependency reaches for CommonJS `require`
		// at run time. This hands it one built from the module's own URL.
		banner: { js: "import { createRequire as __cjsRequire } from 'node:module'; const require = __cjsRequire(import.meta.url);" },
		outfile: out,
		logLevel: 'error',
	});

if (invokedDirectly({ moduleUrl: import.meta.url })) {
	const outFlag = process.argv.indexOf('--out');

	// The exit code is set rather than forced with `process.exit`: writes to a
	// pipe are asynchronous, and exiting right after a log discards it.
	if (outFlag !== -1 && process.argv[outFlag + 1] === undefined) {
		console.error('--out needs a file path');
		process.exitCode = 1;
	} else {
		const out = outFlag === -1 ? join(repoRoot, 'plugin', 'dist', 'cli.mjs') : resolve(process.argv[outFlag + 1]);

		await buildEngine({ out });

		console.log(`built engine → ${out.replace(`${repoRoot}/`, '')}`);
	}
}
